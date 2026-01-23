<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\ChatbotController;
use App\Http\Controllers\ChatbotTrainingController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\StoryController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\SpaceController;
use App\Http\Controllers\AIController;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules;
use Illuminate\Auth\Events\Registered;


Route::group(["middleware" => ["auth:sanctum"]], function() {

    // Profile routes
    Route::get('/users', [AuthenticatedSessionController::class, 'getUsers']); //maybe needed later
    Route::get('/user', [AuthenticatedSessionController::class, 'getUser']);
    Route::get('/profiles/{user}', [ProfileController::class, 'show']);
    Route::post('/profiles/{user}/follow', [ProfileController::class, 'follow']);


    Route::post('/chatbot', [ChatbotController::class, 'handleMessage']);
    Route::post('/test-csrf', fn () => [1, 2, 3]);

    Route::post('/logout', function (Request $request) {
        // Fix the typo in currentAccessToken and proper method call
        $request->user()->currentAccessToken()->delete();
        return response()->noContent();
    });


    // Training endpoints
    Route::prefix('chatbot-training')->group(function() {
        Route::get('/', [ChatbotTrainingController::class, 'index']);
        Route::post('/', [ChatbotTrainingController::class, 'store']);
        Route::put('/{id}', [ChatbotTrainingController::class, 'update']);
        Route::post('/bulk-approve', [ChatbotTrainingController::class, 'bulkApprove']);
        Route::get('/needs-review', [ChatbotTrainingController::class, 'needsReview']);
        Route::get('/categories', [ChatbotTrainingController::class, 'categories']);
        Route::delete('/delete/{id}', [ChatbotTrainingController::class, 'destroy']);
    });

    Route::prefix('profile')->group(function () {
        Route::post('/photo', [ProfileController::class, 'uploadPhoto']);
        Route::delete('/photo', [ProfileController::class, 'deletePhoto']);
        Route::post('/name', [ProfileController::class, 'updateName']);
        Route::get('/followers', [ProfileController::class, 'followers']);
        Route::get('/following', [ProfileController::class, 'following']);
    });

    // Stories
    Route::get('/stories', [StoryController::class, 'index']);
    Route::post('/stories', [StoryController::class, 'store']);
    Route::get('/stories/{story}', [StoryController::class, 'show']);
    Route::get('/users/{user}/stories', [StoryController::class, 'userStories']);
    Route::post('/stories/{story}/view', [StoryController::class, 'markAsViewed']);
    
    // Posts
    Route::get('/posts', [PostController::class, 'index']);
    Route::post('/posts', [PostController::class, 'store']);
    Route::match(['put', 'post'], '/posts/{post}', [PostController::class, 'update']);
    Route::delete('/posts/{post}', [PostController::class, 'destroy']);

    Route::post('/posts/{post}/repost', [PostController::class, 'repost']);
    Route::post('/posts/{post}/share', [PostController::class, 'share']);
    Route::post('/posts/{post}/bookmark', [PostController::class, 'bookmark']);
    Route::delete('/posts/{post}/media/{media}', [PostController::class, 'deleteMedia']);
    // Single Post fetch
    Route::get('/posts/{id}', [PostController::class, 'showPost']);
    
    // Reactions
    Route::post('/posts/{post}/react', [PostController::class, 'react']);
    Route::post('/posts/{post}/deletereaction', [PostController::class, 'deleteReaction']);
    Route::post('/comments/{id}/react', [PostController::class, 'reactToComment']); 
    Route::post('/comments/{comment}/deletereaction', [PostController::class, 'deleteCommentReaction']);
    
    // Comments
    Route::post('/posts/{post}/comment', [PostController::class, 'comment']);
    Route::delete('/posts/{post}/comments/{comment}', [PostController::class, 'deleteComment']);

    // routes/api.php
    // Route::get('/notifications/missed', [NotificationController::class, 'missedNotifications'] );
});

Route::post('/forgot-password', [PasswordResetLinkController::class, 'store']);
// Route::get('/reset-password/{token}', [PasswordResetController::class, 'showResetForm'])->name('password.reset');

// Route::post('/login', [AuthenticatedSessionController::class, 'login']);
// routes/web.php
Route::get('/admin/chatbot/train', [ChatbotTrainingController::class, 'show']);
Route::post('/admin/chatbot/train', [ChatbotTrainingController::class, 'store']);




Route::middleware(['auth:sanctum'])->group(function () {
    // Notifications endpoint
    Route::get('/notifications/missed', [NotificationController::class, 'missedNotifications']);
    
    // Collaboration Spaces (keep your existing spaces routes)
    Route::prefix('spaces')->group(function () {
        Route::get('/', [SpaceController::class, 'index']);
        Route::post('/', [SpaceController::class, 'store']);
        Route::get('/{id}', [SpaceController::class, 'show']);
        Route::put('/{id}', [SpaceController::class, 'update']);
        Route::delete('/{id}', [SpaceController::class, 'destroy']);
        Route::post('/{id}/join', [SpaceController::class, 'join']);
        Route::post('/{id}/leave', [SpaceController::class, 'leave']);
        Route::post('/{id}/invite', [SpaceController::class, 'invite']);
        Route::post('/{id}/start-call', [SpaceController::class, 'startCall']);
        Route::post('/{id}/end-call', [SpaceController::class, 'endCall']);
        Route::post('/{id}/share-screen', [SpaceController::class, 'shareScreen']);
        Route::post('/{id}/magic', [SpaceController::class, 'triggerMagic']);
        Route::get('/{id}/participants', [SpaceController::class, 'getParticipants']);
        Route::get('/{id}/ai-suggestions', [SpaceController::class, 'getAISuggestions']);
        Route::post('/{id}/ai-query', [SpaceController::class, 'aiQuery']);
    });
});

Route::prefix('ai')->middleware('auth:sanctum')->group(function () {
    Route::get('/interactions', [AIController::class, 'getInteractions']);
    Route::post('/interactions/{id}/feedback', [AIController::class, 'provideFeedback']);
    Route::post('/spaces/{id}/learn', [AIController::class, 'learnFromSpace']);
    Route::get('/posts/{id}/enhance', [AIController::class, 'enhancePost']);
    Route::get('/stories/{id}/continue', [AIController::class, 'suggestStoryContinuation']);
    Route::post('/enhance-comment', [AIController::class, 'enhanceComment']);
});

// Enhance existing post routes
Route::prefix('posts')->middleware('auth:sanctum')->group(function () {
    // ... your existing routes ...
    Route::post('/{id}/make-collaborative', [PostController::class, 'makeCollaborative']);
    Route::post('/{id}/add-voice-annotation', [PostController::class, 'addVoiceAnnotation']);
    Route::post('/{id}/create-branch', [PostController::class, 'createBranch']);
    Route::post('/{id}/merge-branch', [PostController::class, 'mergeBranch']);
});

// Enhance existing story routes
Route::prefix('stories')->middleware('auth:sanctum')->group(function () {
    // ... your existing routes ...
    Route::post('/{id}/make-collaborative', [StoryController::class, 'makeCollaborative']);
    Route::post('/{id}/add-to-chain', [StoryController::class, 'addToChain']);
    Route::post('/{id}/choose-branch', [StoryController::class, 'chooseBranch']);
});

// User spaces
Route::get('/users/{id}/spaces', [SpaceController::class, 'getUserSpaces'])->middleware('auth:sanctum');


// Authentication routes
Route::post('/login', function(Request $request){
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

Route::post("/register", function (request $request) {

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'device_name' => ['required'],
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
        ]);

        event(new Registered($user));

        // Auth::login($user);

        // return to_route('dashboard');
        
        return response()->json([
            'token' => $user->createToken($request->device_name)->plainTextToken
        ]);
});
