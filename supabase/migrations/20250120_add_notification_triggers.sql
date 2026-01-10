-- Migration to add notification triggers for matches, friend requests, and friend accepts
-- This migration assumes the following tables exist:
-- - matches (or similar table for mutual likes)
-- - friend_requests (or similar table)
-- - notifications table with create_notification function

-- Function to notify when a match is created
-- This should be called when two users mutually like each other
CREATE OR REPLACE FUNCTION notify_new_match()
RETURNS TRIGGER AS $$
DECLARE
    v_user1_name TEXT;
    v_user2_name TEXT;
    v_user1_image TEXT;
    v_user2_image TEXT;
BEGIN
    -- Get user 1 profile
    SELECT 
        COALESCE(first_name || ' ' || COALESCE(last_name, ''), 'Someone') as name,
        profile_picture
    INTO v_user1_name, v_user1_image
    FROM music_lover_profiles
    WHERE id = NEW.user1_id;

    -- Get user 2 profile
    SELECT 
        COALESCE(first_name || ' ' || COALESCE(last_name, ''), 'Someone') as name,
        profile_picture
    INTO v_user2_name, v_user2_image
    FROM music_lover_profiles
    WHERE id = NEW.user2_id;

    -- Notify user 1
    PERFORM create_notification(
        p_user_id := NEW.user1_id,
        p_type := 'new_match',
        p_title := 'You''ve got a new match!',
        p_body := 'You and ' || v_user2_name || ' liked each other',
        p_data := jsonb_build_object(
            'match_id', NEW.id,
            'match_name', v_user2_name
        ),
        p_image_url := v_user2_image,
        p_deep_link := '/matches/' || NEW.id,
        p_related_id := NEW.id,
        p_related_type := 'match'
    );

    -- Notify user 2
    PERFORM create_notification(
        p_user_id := NEW.user2_id,
        p_type := 'new_match',
        p_title := 'You''ve got a new match!',
        p_body := 'You and ' || v_user1_name || ' liked each other',
        p_data := jsonb_build_object(
            'match_id', NEW.id,
            'match_name', v_user1_name
        ),
        p_image_url := v_user1_image,
        p_deep_link := '/matches/' || NEW.id,
        p_related_id := NEW.id,
        p_related_type := 'match'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to notify when a friend request is sent
-- Adjust table/column names based on your schema
CREATE OR REPLACE FUNCTION notify_friend_request()
RETURNS TRIGGER AS $$
DECLARE
    v_sender_name TEXT;
    v_sender_image TEXT;
BEGIN
    -- Get sender profile
    SELECT 
        COALESCE(first_name || ' ' || COALESCE(last_name, ''), 'Someone') as name,
        profile_picture
    INTO v_sender_name, v_sender_image
    FROM music_lover_profiles
    WHERE id = NEW.sender_id;

    -- Notify receiver
    PERFORM create_notification(
        p_user_id := NEW.receiver_id,
        p_type := 'friend_request',
        p_title := 'New Friend Request',
        p_body := v_sender_name || ' sent you a friend request',
        p_data := jsonb_build_object(
            'sender_id', NEW.sender_id,
            'sender_name', v_sender_name
        ),
        p_image_url := v_sender_image,
        p_deep_link := '/profile/' || NEW.sender_id,
        p_sender_id := NEW.sender_id,
        p_related_id := NEW.sender_id,
        p_related_type := 'friend_request'
    );

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to notify when a friend request is accepted
-- This should be called when the friendship status changes to 'accepted'
CREATE OR REPLACE FUNCTION notify_friend_accept()
RETURNS TRIGGER AS $$
DECLARE
    v_accepter_name TEXT;
    v_accepter_image TEXT;
    v_requester_id UUID;
BEGIN
    -- Determine who accepted and who requested
    -- Adjust based on your schema - this assumes NEW contains the updated friendship
    IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
        -- Get accepter profile (the person who just accepted)
        SELECT 
            COALESCE(first_name || ' ' || COALESCE(last_name, ''), 'Someone') as name,
            profile_picture,
            id
        INTO v_accepter_name, v_accepter_image, v_requester_id
        FROM music_lover_profiles
        WHERE id = NEW.user1_id OR id = NEW.user2_id;

        -- Determine the requester (the other user)
        v_requester_id := CASE 
            WHEN NEW.user1_id = (SELECT id FROM music_lover_profiles WHERE id = NEW.user1_id LIMIT 1)
            THEN NEW.user2_id
            ELSE NEW.user1_id
        END;

        -- Notify the requester that their request was accepted
        PERFORM create_notification(
            p_user_id := v_requester_id,
            p_type := 'friend_accept',
            p_title := 'Friend Request Accepted',
            p_body := v_accepter_name || ' accepted your friend request',
            p_data := jsonb_build_object(
                'friend_id', (SELECT id FROM music_lover_profiles WHERE id != v_requester_id LIMIT 1),
                'friend_name', v_accepter_name
            ),
            p_image_url := v_accepter_image,
            p_deep_link := '/profile/' || (SELECT id FROM music_lover_profiles WHERE id != v_requester_id LIMIT 1),
            p_sender_id := (SELECT id FROM music_lover_profiles WHERE id != v_requester_id LIMIT 1),
            p_related_id := (SELECT id FROM music_lover_profiles WHERE id != v_requester_id LIMIT 1),
            p_related_type := 'friend_accept'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: The actual trigger creation depends on your table schema
-- Uncomment and adjust the table/column names based on your actual schema:

-- Example trigger for matches (adjust table name and columns):
-- CREATE TRIGGER trigger_notify_new_match
--     AFTER INSERT ON matches
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_new_match();

-- Example trigger for friend requests (adjust table name and columns):
-- CREATE TRIGGER trigger_notify_friend_request
--     AFTER INSERT ON friend_requests
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_friend_request();

-- Example trigger for friend accepts (adjust table name and columns):
-- CREATE TRIGGER trigger_notify_friend_accept
--     AFTER UPDATE ON friendships
--     FOR EACH ROW
--     WHEN (NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted'))
--     EXECUTE FUNCTION notify_friend_accept();

