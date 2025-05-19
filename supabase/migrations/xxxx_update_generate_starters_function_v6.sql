-- Migration v6: Update generate_conversation_starters_from_api
-- Uses http_post to get request_id, then http_collect_response_detailed.

-- Drop the function if it already exists to avoid errors on re-creation
DROP FUNCTION IF EXISTS public.generate_conversation_starters_from_api(TEXT[]);

CREATE OR REPLACE FUNCTION public.generate_conversation_starters_from_api(
  p_common_tags TEXT[]
)
RETURNS JSONB -- Returns a JSON array of text strings or an error object
LANGUAGE plpgsql
VOLATILE -- Indicates the function has side effects (HTTP request)
PARALLEL UNSAFE -- External requests are not parallel safe
AS $$
DECLARE
  gemini_api_key TEXT;
  prompt_text TEXT;
  tags_string TEXT;
  payload JSONB;
  request_url TEXT;
  
  request_id BIGINT;       -- To store the ID from http_post
  api_status_code INT;     -- To store the status code from http_collect_response_detailed
  api_headers JSONB;       -- To store headers from http_collect_response_detailed
  api_body TEXT;           -- To store the body from http_collect_response_detailed

  response_content JSONB;  -- For the parsed JSON body
  full_response_text TEXT;
  starters_array TEXT[];
  error_message TEXT;
BEGIN
  -- Get the API key
  SELECT public.get_google_api_key() INTO gemini_api_key;

  IF gemini_api_key IS NULL THEN
    RAISE WARNING '[StartersFunc-v6] Google Gemini API key is not available.';
    RETURN jsonb_build_object('error', 'API key not configured');
  END IF;

  -- Construct the prompt
  tags_string := array_to_string(p_common_tags, ', ');
  prompt_text := format(
    'Generate 3 friendly, casual opening chat messages for someone starting a conversation with another user who shares interests in ''%s''. Keep each message short, distinct, and easy to click and send. Return each message on a new line. Do not use any numbering or bullet points. Example for interest ''vintage video games'': Hey, saw you''re into vintage games too! What''s your all-time favorite console? That''s awesome you like retro gaming! Any hidden gems you''d recommend? Fellow vintage gamer here! What was the first classic game that got you hooked? Example for interest ''gardening'': Hi! Noticed you enjoy gardening. What are you growing this season? Cool, another plant enthusiast! Any tips for keeping houseplants happy? Saw gardening is one of your interests! Favorite thing to grow?',
    tags_string
  );

  payload := jsonb_build_object(
    'contents', jsonb_build_array(
      jsonb_build_object(
        'parts', jsonb_build_array(
          jsonb_build_object('text', prompt_text)
        )
      )
    )
  );

  request_url := 'https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=' || gemini_api_key;
  
  RAISE LOG '[StartersFunc-v6] Attempting to call Gemini API. URL: %, Payload: %', request_url, payload::text;

  BEGIN
    -- Make the HTTP POST request to get a request_id
    request_id := extensions.http_post(
        url := request_url,
        body := payload,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        timeout_milliseconds := 7000
    );

    IF request_id IS NULL THEN
        RAISE WARNING '[StartersFunc-v6] pg_net.http_post did not return a request_id.';
        RETURN jsonb_build_object('error', 'pg_net.http_post failed to return a request_id');
    END IF;

    RAISE LOG '[StartersFunc-v6] Got request_id: %', request_id;

    -- Collect the response details synchronously
    SELECT cds.status_code, cds.headers, cds.body 
    INTO api_status_code, api_headers, api_body
    FROM extensions.http_collect_response_detailed(request_id, async := false) AS cds;

    RAISE LOG '[StartersFunc-v6] Gemini API call collected. Status: %, Headers: %', api_status_code, api_headers;

    IF api_status_code != 200 THEN
      error_message := format('[StartersFunc-v6] Gemini API request failed. Status: %s. Response Body: %s', api_status_code, COALESCE(api_body, 'No content returned from API.'));
      RAISE WARNING '%', error_message;
      RETURN jsonb_build_object('error', error_message, 'api_status_code', api_status_code, 'api_response_preview', left(api_body, 200));
    END IF;

    BEGIN
        response_content := api_body::JSONB;
        RAISE LOG '[StartersFunc-v6] Gemini API response content (parsed as JSON): %', response_content::text;
    EXCEPTION
        WHEN others THEN
            RAISE WARNING '[StartersFunc-v6] Failed to parse Gemini API response as JSON. SQLSTATE: %, SQLERRM: %, Raw Body: %', SQLSTATE, SQLERRM, left(api_body, 500);
            RETURN jsonb_build_object('error', 'Failed to parse API response as JSON', 'raw_body_preview', left(api_body, 200));
    END;

    full_response_text := response_content->'candidates'->0->'content'->'parts'->0->'text';

    IF full_response_text IS NULL THEN
      RAISE WARNING '[StartersFunc-v6] Could not extract text from Gemini response. Parsed: %', response_content::text;
      RETURN jsonb_build_object('error', 'Failed to extract text from Gemini response structure', 'parsed_api_response', response_content);
    END IF;
    RAISE LOG '[StartersFunc-v6] Extracted text: %', full_response_text;

    starters_array := string_to_array(trim(full_response_text), E'\n');
    SELECT array_agg(s) INTO starters_array FROM unnest(starters_array) s WHERE trim(s) <> '';

    IF array_length(starters_array, 1) IS NULL OR array_length(starters_array, 1) = 0 THEN
        RAISE WARNING '[StartersFunc-v6] No valid starters after parsing. Raw text: %', full_response_text;
        RETURN jsonb_build_object('error', 'No starters generated or failed to parse from API.', 'raw_gemini_text', full_response_text);
    END IF;
    
    RAISE LOG '[StartersFunc-v6] Generated starters: %', starters_array::text;
    RETURN jsonb_build_object('starters', starters_array);

  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
      RAISE WARNING '[StartersFunc-v6] Exception: %. SQLSTATE: %. SQLERRM: %', error_message, SQLSTATE, SQLERRM;
      RETURN jsonb_build_object('error', 'Failed to call/process Gemini API: ' || SQLERRM);
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_conversation_starters_from_api(TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.generate_conversation_starters_from_api(TEXT[]) IS 'v6: Generates conversation starters by calling Google Gemini API using pg_net (http_post + http_collect_response_detailed).'; 