<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\PasswordResetLinkController;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Validation\Rules;
use Illuminate\Auth\Events\Registered;


Route::group(["middleware" => ["auth:sanctum"]], function() {

    Route::get('/users', [AuthenticatedSessionController::class, 'getUsers']);
    
    Route::get('/user', [AuthenticatedSessionController::class, 'getUser']);
    
    // Route::get('/user', function (Request $request) {
    //     return $request->user();
    // })->middleware('auth:sanctum');

    Route::post('/test-csrf', fn () => [1, 2, 3]);

    Route::post('/logout', function (Request $request) {
        // Fix the typo in currentAccessToken and proper method call
        $request->user()->currentAccessToken()->delete();
        return response()->noContent();
    });
});

Route::post('/forgot-password', [PasswordResetLinkController::class, 'store']);

// Route::post('/login', [AuthenticatedSessionController::class, 'login']);

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