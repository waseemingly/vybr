-- Migration v5: Update generate_conversation_starters_from_api
-- Uses named arguments for http_post, omits params, handles http_response type.

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
  http_res extensions.http_response; -- Variable to store the full HTTP response
  response_content JSONB;
  full_response_text TEXT;
  starters_array TEXT[];
  error_message TEXT;
BEGIN
  -- Get the API key
  SELECT public.get_google_api_key() INTO gemini_api_key;

  IF gemini_api_key IS NULL THEN
    RAISE WARNING '[StartersFunc] Google Gemini API key is not available.';
    RETURN jsonb_build_object('error', 'API key not configured');
  END IF;

  -- Construct the prompt
  tags_string := array_to_string(p_common_tags, ', ');
  prompt_text := format(
    'Generate 3 friendly, casual opening chat messages for someone starting a conversation with another user who shares interests in ''%s''. Keep each message short, distinct, and easy to click and send. Return each message on a new line. Do not use any numbering or bullet points. Example for interest ''vintage video games'': Hey, saw you''re into vintage games too! What''s your all-time favorite console? That''s awesome you like retro gaming! Any hidden gems you''d recommend? Fellow vintage gamer here! What was the first classic game that got you hooked? Example for interest ''gardening'': Hi! Noticed you enjoy gardening. What are you growing this season? Cool, another plant enthusiast! Any tips for keeping houseplants happy? Saw gardening is one of your interests! Favorite thing to grow?',
    tags_string
  );

  -- Construct the payload for Gemini API
  payload := jsonb_build_object(
    'contents', jsonb_build_array(
      jsonb_build_object(
        'parts', jsonb_build_array(
          jsonb_build_object('text', prompt_text)
        )
      )
    )
    -- 'generationConfig', jsonb_build_object('temperature', 0.7, 'maxOutputTokens', 250),
    -- 'safetySettings', jsonb_build_array(...)
  );

  -- Use gemini-1.0-pro. API key in query param.
  request_url := 'https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=' || gemini_api_key;
  
  RAISE LOG '[StartersFunc] Attempting to call Gemini API. URL: %, Payload: %', request_url, payload::text;

  BEGIN
    SELECT * INTO http_res -- Store the entire http_response record
    FROM extensions.http_post(
        url := request_url,
        body := payload,
        -- params argument is omitted, relying on its DEFAULT NULL value
        headers := jsonb_build_object('Content-Type', 'application/json'),
        timeout_milliseconds := 7000 -- Increased timeout
    );

    RAISE LOG '[StartersFunc] Gemini API call completed. Status: %, Headers: %', http_res.status_code, http_res.headers;
    -- Content logged further down if valid JSON

    IF http_res.status_code != 200 THEN
      error_message := format('[StartersFunc] Gemini API request failed. Status: %s. Response Body: %s', http_res.status_code, COALESCE(http_res.content, 'No content returned from API.'));
      RAISE WARNING '%', error_message;
      RETURN jsonb_build_object('error', error_message, 'api_status_code', http_res.status_code, 'api_response_preview', left(http_res.content, 200));
    END IF;

    -- Attempt to parse the content as JSONB
    BEGIN
        response_content := http_res.content::JSONB;
        RAISE LOG '[StartersFunc] Gemini API response content (parsed as JSON): %', response_content::text;
    EXCEPTION
        WHEN others THEN
            RAISE WARNING '[StartersFunc] Failed to parse Gemini API response content as JSON. SQLSTATE: %, SQLERRM: %, Raw Content: %', SQLSTATE, SQLERRM, left(http_res.content, 500);
            RETURN jsonb_build_object('error', 'Failed to parse API response as JSON', 'raw_content_preview', left(http_res.content, 200));
    END;

    -- Extract the text from the response
    -- Gemini response structure: { "candidates": [ { "content": { "parts": [ { "text": "Starter 1\nStarter 2\nStarter 3" } ] } } ] }
    full_response_text := response_content->'candidates'->0->'content'->'parts'->0->'text';

    IF full_response_text IS NULL THEN
      RAISE WARNING '[StartersFunc] Could not extract text from Gemini response structure. Parsed Response: %', response_content::text;
      RETURN jsonb_build_object('error', 'Failed to extract text from Gemini response structure', 'parsed_api_response', response_content);
    END IF;
    RAISE LOG '[StartersFunc] Extracted text from Gemini: %', full_response_text;

    -- Split the single string into an array of starters
    starters_array := string_to_array(trim(full_response_text), E'\n');
    
    -- Filter out any empty strings that might result from multiple newlines
    SELECT array_agg(s) INTO starters_array FROM unnest(starters_array) s WHERE trim(s) <> '';

    IF array_length(starters_array, 1) IS NULL OR array_length(starters_array, 1) = 0 THEN
        RAISE WARNING '[StartersFunc] No valid conversation starters generated after parsing. Raw text: %', full_response_text;
        RETURN jsonb_build_object('error', 'No starters generated or failed to parse them from API output.', 'raw_gemini_text', full_response_text);
    END IF;
    
    RAISE LOG '[StartersFunc] Successfully generated starters: %', starters_array::text;
    RETURN jsonb_build_object('starters', starters_array);

  EXCEPTION
    WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS error_message = MESSAGE_TEXT;
      RAISE WARNING '[StartersFunc] Exception during http_post or subsequent processing: %. SQLSTATE: %. SQLERRM: %', error_message, SQLSTATE, SQLERRM;
      RETURN jsonb_build_object('error', 'Failed to call Gemini API or process response: ' || SQLERRM);
  END;
END;
$$;

-- Grant execute permission to the 'authenticated' role (or the specific role your app uses)
GRANT EXECUTE ON FUNCTION public.generate_conversation_starters_from_api(TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.generate_conversation_starters_from_api(TEXT[]) IS 'Generates conversation starters based on common tags by calling Google Gemini API using pg_net.'; 