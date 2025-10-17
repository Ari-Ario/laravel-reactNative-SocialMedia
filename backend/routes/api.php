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


    Route::post('/chat', [ChatbotController::class, 'handleMessage']);
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
    
    // Reactions
    Route::post('/posts/{post}/react', [PostController::class, 'react']);
    Route::post('/posts/{post}/deletereaction', [PostController::class, 'deleteReaction']);
    Route::post('/comments/{id}/react', [PostController::class, 'reactToComment']); 
    Route::post('/comments/{comment}/deletereaction', [PostController::class, 'deleteCommentReaction']);
    
    // Comments
    Route::post('/posts/{post}/comment', [PostController::class, 'comment']);
    Route::delete('/posts/{post}/comments/{comment}', [PostController::class, 'deleteComment']);

    // routes/api.php
    Route::get('/notifications/missed', [NotificationController::class, 'missedNotifications'] );
});

Route::post('/forgot-password', [PasswordResetLinkController::class, 'store']);
// Route::get('/reset-password/{token}', [PasswordResetController::class, 'showResetForm'])->name('password.reset');

// Route::post('/login', [AuthenticatedSessionController::class, 'login']);
// routes/web.php
Route::get('/admin/chatbot/train', [ChatbotTrainingController::class, 'show']);
Route::post('/admin/chatbot/train', [ChatbotTrainingController::class, 'store']);

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
