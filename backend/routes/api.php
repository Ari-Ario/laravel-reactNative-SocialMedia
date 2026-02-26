<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\ChatbotTrainingController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SpaceController;
use App\Http\Controllers\AIController;
use App\Http\Controllers\SynchronicityController;
use App\Http\Controllers\CollaborativeActivityController;
use App\Http\Controllers\MessagesController;
use App\Http\Controllers\UserSearchController;
use App\Http\Controllers\PollController;
use Illuminate\Support\Facades\Broadcast;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Event;

Route::post('/broadcasting/auth', function (Request $request) {
    return Broadcast::auth($request);
})->middleware('auth:sanctum');

Route::group(["middleware" => ["auth:sanctum"]], function () {

    // Profile routes
    Route::get('/users', [AuthenticatedSessionController::class , 'getUsers']); //maybe needed later
    Route::get('/user', [AuthenticatedSessionController::class , 'getUser']);
    Route::get('/profiles/{user}', [ProfileController::class , 'show']);
    Route::post('/profiles/{user}/follow', [ProfileController::class , 'follow']);

    Route::post('/chatbot', [ChatbotController::class , 'handleMessage']);
    Route::post('/test-csrf', fn() => [1, 2, 3]);

    Route::post('/logout', function (Request $request) {
            // Fix the typo in currentAccessToken and proper method call
            $request->user()->currentAccessToken()->delete();
            return response()->noContent();
        }
        );


        // Training endpoints
        Route::prefix('chatbot-training')->group(function () {
            Route::get('/', [ChatbotTrainingController::class , 'index']);
            Route::post('/', [ChatbotTrainingController::class , 'store']);
            Route::put('/{id}', [ChatbotTrainingController::class , 'update']);
            Route::post('/bulk-approve', [ChatbotTrainingController::class , 'bulkApprove']);
            Route::get('/needs-review', [ChatbotTrainingController::class , 'needsReview']);
            Route::get('/categories', [ChatbotTrainingController::class , 'categories']);
            Route::delete('/delete/{id}', [ChatbotTrainingController::class , 'destroy']);
        }
        );

        Route::prefix('profile')->group(function () {
            Route::post('/photo', [ProfileController::class , 'uploadPhoto']);
            Route::delete('/photo', [ProfileController::class , 'deletePhoto']);
            Route::post('/name', [ProfileController::class , 'updateName']);
            Route::get('/followers', [ProfileController::class , 'followers']);
            Route::get('/following', [ProfileController::class , 'following']);
        }
        );

        // Stories
        Route::get('/stories', [StoryController::class , 'index']);
        Route::post('/stories', [StoryController::class , 'store']);
        Route::get('/stories/{story}', [StoryController::class , 'show']);
        Route::get('/users/{user}/stories', [StoryController::class , 'userStories']);
        Route::post('/stories/{story}/view', [StoryController::class , 'markAsViewed']);

        // Posts
        Route::get('/posts', [PostController::class , 'index']);
        Route::post('/posts', [PostController::class , 'store']);
        Route::match (['put', 'post'], '/posts/{post}', [PostController::class , 'update']);
        Route::delete('/posts/{post}', [PostController::class , 'destroy']);

        Route::post('/posts/{post}/repost', [PostController::class , 'repost']);
        Route::post('/posts/{post}/share', [PostController::class , 'share']);
        Route::post('/posts/{post}/bookmark', [PostController::class , 'bookmark']);
        Route::delete('/posts/{post}/media/{media}', [PostController::class , 'deleteMedia']);
        // Single Post fetch
        Route::get('/posts/{id}', [PostController::class , 'showPost']);

        // Reactions
        Route::post('/posts/{post}/react', [PostController::class , 'react']);
        Route::post('/posts/{post}/deletereaction', [PostController::class , 'deleteReaction']);
        Route::post('/comments/{id}/react', [PostController::class , 'reactToComment']);
        Route::post('/comments/{comment}/deletereaction', [PostController::class , 'deleteCommentReaction']);

        // Comments
        Route::post('/posts/{post}/comment', [PostController::class , 'comment']);
        Route::delete('/posts/{post}/comments/{comment}', [PostController::class , 'deleteComment']);

    // routes/api.php
    // Route::get('/notifications/missed', [NotificationController::class, 'missedNotifications'] );
    });


Route::get('/admin/chatbot/train', [ChatbotTrainingController::class , 'show']);
Route::post('/admin/chatbot/train', [ChatbotTrainingController::class , 'store']);


Route::middleware(['auth:sanctum'])->group(function () {
    // Notifications endpoint
    Route::get('/notifications/missed', [NotificationController::class , 'missedNotifications']);

    // search for spaces
    Route::post('/search', [SpaceController::class , 'search']);

    // search to add users to space
    Route::post('/search/users', [UserSearchController::class , 'search']);
    Route::post('/users/lookup', [UserSearchController::class , 'lookup']);

    // Collaboration Spaces (keep your existing spaces routes)
    Route::prefix('spaces')->group(function () {
            Route::get('/', [SpaceController::class , 'index']);
            Route::post('/', [SpaceController::class , 'store']);
            Route::get('/{id}', [SpaceController::class , 'show']);
            Route::put('/{id}', [SpaceController::class , 'update']);
            Route::put('/{id}/content', [SpaceController::class , 'updateContentState']);
            Route::delete('/{id}', [SpaceController::class , 'destroy']);
            Route::post('/{id}/join', [SpaceController::class , 'join']);
            Route::post('/{id}/leave', [SpaceController::class , 'leave']);
            Route::post('/{id}/invite', [SpaceController::class , 'invite']);
            Route::post('/{id}/accept-invitation', [SpaceController::class , 'acceptInvitation']);
            Route::post('/{id}/start-call', [SpaceController::class , 'startCall']);
            Route::post('/{id}/end-call', [SpaceController::class , 'endCall']);
            Route::post('/{id}/share-screen', [SpaceController::class , 'shareScreen']);
            Route::post('/{id}/magic', [SpaceController::class , 'triggerMagic']);
            Route::get('/{id}/participants', [SpaceController::class , 'getParticipants']);
            Route::get('/{id}/ai-suggestions', [SpaceController::class , 'getAISuggestions']);
            Route::post('/{id}/ai-query', [SpaceController::class , 'aiQuery']);
            Route::post('/{id}/upload-media', [SpaceController::class , 'uploadMedia']);
            Route::get('/{id}/media', [SpaceController::class , 'getMedia']);
            Route::delete('/{id}/media/{mediaId}', [SpaceController::class , 'deleteMedia']);
            Route::post('/{id}/send-message', [SpaceController::class , 'sendMessage']);
            Route::post('/{id}/participants/{userId}/role', [SpaceController::class , 'updateParticipantRole']);
            Route::delete('/{id}/participants/{userId}', [SpaceController::class , 'removeParticipant']);

            // Poll routes
            Route::get('/{id}/polls', [PollController::class , 'index']);
            Route::post('/{id}/polls', [PollController::class , 'store']);
            Route::get('/{id}/polls/{pollId}', [PollController::class , 'show']);
            Route::post('/{id}/polls/{pollId}/vote', [PollController::class , 'vote']);
            Route::post('/{id}/polls/{pollId}/close', [PollController::class , 'close']);
            Route::get('/{id}/polls/{pollId}/results', [PollController::class , 'results']);
            Route::put('/{id}/polls/{pollId}', [PollController::class , 'update']);
            Route::delete('/{id}/polls/{pollId}', [PollController::class , 'destroy']);
        });
        // Add to routes/api.php inside auth:sanctum group
        Route::prefix('spaces/{id}/whiteboard')->group(function () {
            Route::get('/elements', [WhiteboardController::class, 'getElements']);
            Route::post('/elements', [WhiteboardController::class, 'addElement']);
            Route::put('/elements/{elementId}', [WhiteboardController::class, 'updateElement']);
            Route::delete('/elements/{elementId}', [WhiteboardController::class, 'removeElement']);
            Route::post('/clear', [WhiteboardController::class, 'clear']);
            Route::post('/cursor', [WhiteboardController::class, 'updateCursor']);
        });
        Route::post('/spaces/{id}/call/signal', [SpaceController::class , 'callSignal']);
        Route::post('/spaces/{id}/call/mute', [SpaceController::class , 'callMute']);
        Route::post('/spaces/{id}/call/video', [SpaceController::class , 'callVideo']);
        Route::post('/spaces/{id}/call/screen-share', [SpaceController::class , 'callScreenShare']);
        // forward poll to space
        Route::post('/polls/{pollId}/forward', [PollController::class , 'forward']);
    });

// Message routes
Route::middleware('auth:sanctum')->prefix('messages')->group(function () {
    Route::get('/', [MessagesController::class , 'index']);
    Route::post('/', [MessagesController::class , 'store']);
    Route::put('/{id}', [MessagesController::class , 'update']);
    Route::delete('/{id}', [MessagesController::class , 'destroy']);
    Route::post('/{id}/react', [MessagesController::class , 'react']);
    Route::delete('/{id}/reaction', [MessagesController::class , 'deleteReaction']);
});

// Notification routes
Route::middleware('auth:sanctum')->prefix('notifications')->group(function () {
    Route::get('/missed', [NotificationController::class , 'missedNotifications']);
    Route::post('/register-device', [NotificationController::class , 'registerDevice']);
    Route::post('/unregister-device', [NotificationController::class , 'unregisterDevice']);
    Route::post('/{id}/read', [NotificationController::class , 'markAsRead']);
    Route::post('/read-all', [NotificationController::class , 'markAllAsRead']);
    Route::delete('/clear', [NotificationController::class , 'clearAll']);
    Route::get('/preferences', [NotificationController::class , 'getPreferences']);
    Route::put('/preferences', [NotificationController::class , 'updatePreferences']);
});

Route::prefix('ai')->middleware('auth:sanctum')->group(function () {
    Route::get('/interactions', [AIController::class , 'getInteractions']);
    Route::post('/interactions/{id}/feedback', [AIController::class , 'provideFeedback']);
    Route::post('/spaces/{id}/learn', [AIController::class , 'learnFromSpace']);
    Route::get('/posts/{id}/enhance', [AIController::class , 'enhancePost']);
    Route::get('/stories/{id}/continue', [AIController::class , 'suggestStoryContinuation']);
    Route::post('/enhance-comment', [AIController::class , 'enhanceComment']);
});

// Enhance existing post routes
Route::prefix('posts')->middleware('auth:sanctum')->group(function () {
    // ... your existing routes ...
    Route::post('/{id}/make-collaborative', [PostController::class , 'makeCollaborative']);
    Route::post('/{id}/add-voice-annotation', [PostController::class , 'addVoiceAnnotation']);
    Route::post('/{id}/create-branch', [PostController::class , 'createBranch']);
    Route::post('/{id}/merge-branch', [PostController::class , 'mergeBranch']);
});

// Enhance existing story routes
Route::prefix('stories')->middleware('auth:sanctum')->group(function () {
    // ... your existing routes ...
    Route::post('/{id}/make-collaborative', [StoryController::class , 'makeCollaborative']);
    Route::post('/{id}/add-to-chain', [StoryController::class , 'addToChain']);
    Route::post('/{id}/choose-branch', [StoryController::class , 'chooseBranch']);
});

// User spaces
Route::get('/users/{id}/spaces', [SpaceController::class , 'getUserSpaces'])->middleware('auth:sanctum');

// Synchronicity routes
Route::middleware('auth:sanctum')->prefix('synchronicity')->group(function () {
    Route::post('/find-matches', [SynchronicityController::class , 'findMatches']);
    Route::post('/events', [SynchronicityController::class , 'storeEvent']);
    Route::get('/space/{spaceId}/matches', [SynchronicityController::class , 'getSpaceMatches']);
});

// Collaborative Activities Routes
Route::middleware('auth:sanctum')->prefix('collaborative-activities')->group(function () {
    Route::post('/', [CollaborativeActivityController::class , 'store']);
    Route::get('/space/{spaceId}', [CollaborativeActivityController::class , 'getSpaceActivities']);
    Route::post('/{activityId}/status', [CollaborativeActivityController::class , 'updateStatus']);
    Route::post('/{activityId}/participants', [CollaborativeActivityController::class , 'updateParticipants']);
    Route::get('/space/{spaceId}/statistics', [CollaborativeActivityController::class , 'getSpaceStatistics']);
});


// Authentication routes
Route::post('/login', function (Request $request) {
    $request->validate([
        'email' => ['required', 'email'],
        'password' => ['required'],
        'device_name' => ['required'],
    ]);

    $user = User::where('email', $request->email)->first();

    if (!$user || !Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages([
            'email' => ['The provided credentials are incorrect']
        ]);
    }

    return response()->json([
    'token' => $user->createToken($request->device_name)->plainTextToken
    ]);
});

// generateUsername helper function
function generateUsername($name, $email)
{
    $baseUsername = preg_replace('/\s+/', '', strtolower($name));
    if (empty($baseUsername)) {
        $baseUsername = explode('@', $email)[0];
    }
    $username = $baseUsername;
    $counter = 1;
    while (User::where('username', $username)->exists()) {
        $username = $baseUsername . $counter;
        $counter++;
    }
    return $username;
}

Route::post("/register", function (request $request) {

    $request->validate([
        'name' => ['required', 'string', 'max:255'],
        'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
        'password' => ['required', 'string', 'min:8', 'confirmed'],
        'device_name' => ['required', 'string'],
        'username' => ['nullable', 'string', 'max:255', 'unique:users'],
    ]);

    // Generate username if not provided
    $username = $request->username ?? generateUsername($request->name, $request->email);

    $user = User::create([
        'name' => $request->name,
        'email' => $request->email,
        'username' => $username,
        'password' => Hash::make($request->password),
    ]);

    // Generate 6-digit verification code
    $verificationCode = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);

    // Store code in cache for 15 minutes
    Cache::put('email_verify_' . $user->id, $verificationCode, 900);

    // Send code via email
    Mail::raw("Your verification code is: $verificationCode\n\nThis code will expire in 15 minutes.", function ($message) use ($user) {
            $message->to($user->email)
                ->subject('Verify Your Email Address');
        }
        );

        $token = $user->createToken($request->device_name)->plainTextToken;

        return response()->json([
        'token' => $token,
        'user' => $user,
        'message' => 'Registration successful! Check your email for verification code.',
        'requires_verification' => true,
        'verification_method' => 'code', // Indicate code-based verification
        'user_id' => $user->id
        ], 201);
    });

// Add verification endpoint
Route::post('/verify-email-code', function (Request $request) {
    $request->validate([
        'user_id' => ['required', 'integer'],
        'code' => ['required', 'string', 'size:6'],
    ]);

    $cachedCode = Cache::get('email_verify_' . $request->user_id);

    if (!$cachedCode || $cachedCode !== $request->code) {
        return response()->json([
        'message' => 'Invalid or expired verification code'
        ], 400);
    }

    $user = User::find($request->user_id);

    if (!$user) {
        return response()->json(['message' => 'User not found'], 404);
    }

    if ($user->markEmailAsVerified()) {
        event(new Verified($user));
        Cache::forget('email_verify_' . $user->id);

        // Refresh user data to get updated email_verified_at
        $user->refresh();

        // Generate a new token
        $newToken = $user->createToken('verified-email')->plainTextToken;

        return response()->json([
        'message' => 'Email verified successfully!',
        'verified' => true,
        'user' => $user, // Return updated user with email_verified_at
        'token' => $newToken
        ]);
    }

    return response()->json(['message' => 'Verification failed'], 500);
})->middleware('auth:sanctum');

// Resend should also require auth
Route::post('/resend-verification-code', function (Request $request) {
    $request->validate([
        'user_id' => ['required', 'integer'],
    ]);

    $user = User::find($request->user_id);

    if (!$user) {
        return response()->json(['message' => 'User not found'], 404);
    }

    if ($user->hasVerifiedEmail()) {
        return response()->json(['message' => 'Email already verified']);
    }

    // Generate new code
    $verificationCode = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
    Cache::put('email_verify_' . $user->id, $verificationCode, 900);

    // Send new code
    Mail::raw("Your new verification code is: $verificationCode\n\nThis code will expire in 15 minutes.", function ($message) use ($user) {
            $message->to($user->email)
                ->subject('New Verification Code');
        }
        );

        return response()->json([
        'message' => 'New verification code sent!',
        'user_id' => $user->id
        ]);
    })->middleware('auth:sanctum'); // Add this middleware


// Forgot password - send reset code
Route::post('/forgot-password', function (Request $request) {
    $request->validate(['email' => 'required|email']);

    $user = User::where('email', $request->email)->first();

    if (!$user) {
        return response()->json([
        'message' => 'If this email exists, a reset code has been sent.'
        ]);
    }

    // Generate 6-digit reset code
    $resetCode = str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);

    // Store code in cache for 15 minutes with email
    Cache::put('password_reset_' . $user->email, [
        'code' => $resetCode,
        'user_id' => $user->id
    ], 900);

    // Send code via email
    Mail::raw("Your password reset code is: $resetCode\n\nThis code will expire in 15 minutes.", function ($message) use ($user) {
            $message->to($user->email)
                ->subject('Password Reset Code');
        }
        );

        return response()->json([
        'message' => 'Reset code sent to your email.',
        'email' => $user->email
        ]);
    });

// Verify reset code
Route::post('/verify-reset-code', function (Request $request) {
    $request->validate([
        'email' => 'required|email',
        'code' => 'required|string|size:6'
    ]);

    $cacheKey = 'password_reset_' . $request->email;
    $cachedData = Cache::get($cacheKey);

    if (!$cachedData || $cachedData['code'] !== $request->code) {
        return response()->json([
        'message' => 'Invalid or expired reset code'
        ], 400);
    }

    // Generate a temporary token for password reset
    $tempToken = bin2hex(random_bytes(32));
    Cache::put('reset_token_' . $tempToken, $cachedData['user_id'], 900);

    return response()->json([
    'message' => 'Code verified successfully',
    'reset_token' => $tempToken,
    'user_id' => $cachedData['user_id']
    ]);
});

// Reset password with token
Route::post('/reset-password', function (Request $request) {
    $request->validate([
        'reset_token' => 'required|string',
        'password' => 'required|string|min:8|confirmed'
    ]);

    $cacheKey = 'reset_token_' . $request->reset_token;
    $userId = Cache::get($cacheKey);

    if (!$userId) {
        return response()->json([
        'message' => 'Invalid or expired reset token'
        ], 400);
    }

    $user = User::find($userId);

    if (!$user) {
        return response()->json(['message' => 'User not found'], 404);
    }

    $user->password = Hash::make($request->password);
    $user->save();

    // Clear cache
    Cache::forget($cacheKey);

    return response()->json([
    'message' => 'Password reset successfully!'
    ]);
});