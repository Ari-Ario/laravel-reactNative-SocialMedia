<?php

use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('post.{postId}', function ($user, $postId) {
    return ['id' => $user->id, 'name' => $user->name];
});

// channel for chatbot training
Broadcast::channel('chatbot-training', function ($user) {
    // Allow only private users and admins to listen to this channel
    return $user->is_private || $user->is_admin 
        ? ['id' => $user->id, 'name' => $user->name, 'is_private' => $user->is_private, 'is_admin' => $user->is_admin]
        : false;
});