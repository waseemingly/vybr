import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, prefer',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

console.log('send-message-notifications function started');

// Create a Supabase client with the service role key
const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload = await req.json()
    console.log('Webhook payload received:', payload);

    // The payload from a database webhook is structured
    // We are interested in the new record from an INSERT
    const newMessage = payload.record;

    if (payload.type !== 'INSERT' || !newMessage) {
      console.log('Payload is not an insert or record is missing, skipping.');
      return new Response('Not an insert or record missing', { status: 200 });
    }

    // Determine if it's an individual or group message
    const isGroupMessage = 'group_id' in newMessage;

    if (isGroupMessage) {
      // --- Handle Group Message ---
      const { group_id, sender_id } = newMessage;
      console.log(`Processing group message for group: ${group_id}`);

      // 1. Get all members of the group except the sender
      const { data: members, error: membersError } = await supabaseAdmin
        .from('group_chat_members')
        .select('user_id')
        .eq('group_id', group_id)
        .neq('user_id', sender_id);

      if (membersError) throw membersError;
      if (!members || members.length === 0) {
        console.log('No other members in the group to notify.');
        return new Response('ok', { headers: corsHeaders });
      }

      // 2. Get sender name for notification
      const { data: senderProfile } = await supabaseAdmin
        .from('music_lover_profiles')
        .select('first_name, last_name')
        .eq('id', sender_id)
        .single();

      const senderName = senderProfile 
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || 'Someone'
        : 'Someone';

      // 3. Get group name
      const { data: groupData } = await supabaseAdmin
        .from('group_chats')
        .select('name')
        .eq('id', group_id)
        .single();

      const groupName = groupData?.name || 'Group Chat';

      // 4. Create notification for each member
      const notificationPromises = members.map(async (member) => {
        const notificationPayload = {
          type: 'broadcast',
          event: 'new_group_message_notification',
          payload: { ...newMessage }
        };

        const recipientChannel = `user:${member.user_id}`;
        console.log(`Sending notification to channel: ${recipientChannel}`);
        
        // Also create notification in database
        await supabaseAdmin.rpc('create_notification', {
          p_user_id: member.user_id,
          p_type: 'new_group_message',
          p_title: `${senderName} in ${groupName}`,
          p_body: newMessage.content?.substring(0, 100) || 'New message',
          p_data: {
            sender_id: sender_id,
            sender_name: senderName,
            message_id: newMessage.id,
            group_id: group_id,
            group_name: groupName,
            is_group: true,
          },
          p_deep_link: `/group-chat/${group_id}`,
          p_sender_id: sender_id,
          p_related_id: newMessage.id,
          p_related_type: 'group_message',
        });

        return supabaseAdmin.channel(recipientChannel).send(notificationPayload);
      });

      await Promise.all(notificationPromises);
      console.log(`Sent notifications to ${members.length} group members.`);

    } else {
      // --- Handle Individual Message ---
      const { receiver_id, sender_id } = newMessage;
      if (!receiver_id) {
        console.log('receiver_id is missing, cannot send notification.');
        return new Response('receiver_id missing', { status: 400 });
      }

      // Get sender name
      const { data: senderProfile } = await supabaseAdmin
        .from('music_lover_profiles')
        .select('first_name, last_name')
        .eq('id', sender_id)
        .single();

      const senderName = senderProfile 
        ? `${senderProfile.first_name || ''} ${senderProfile.last_name || ''}`.trim() || 'Someone'
        : 'Someone';

      const recipientChannel = `user:${receiver_id}`;
      console.log(`Processing individual message for receiver: ${receiver_id}`);
      console.log(`Sending notification to channel: ${recipientChannel}`);

      // Create notification in database
      await supabaseAdmin.rpc('create_notification', {
        p_user_id: receiver_id,
        p_type: 'new_message',
        p_title: `New message from ${senderName}`,
        p_body: newMessage.content?.substring(0, 100) || 'New message',
        p_data: {
          sender_id: sender_id,
          sender_name: senderName,
          message_id: newMessage.id,
          chat_id: sender_id,
          is_group: false,
        },
        p_deep_link: `/chat/${sender_id}`,
        p_sender_id: sender_id,
        p_related_id: newMessage.id,
        p_related_type: 'message',
      });

      const notificationPayload = {
        type: 'broadcast',
        event: 'new_message_notification',
        payload: { ...newMessage }
      };

      // Send the notification to the receiver's private channel
      const { error } = await supabaseAdmin
        .channel(recipientChannel)
        .send(notificationPayload);

      if (error) throw error;
      console.log('Successfully sent individual message notification.');
    }

    return new Response('ok', { headers: corsHeaders });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})

