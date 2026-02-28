<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Event;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\Events\Verified;
use Illuminate\Support\Facades\Log;

class ApiAuthController extends Controller
{
    public function login(Request $request)
    {
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

        // Ensure session is started for web clients (if needed)
        \Illuminate\Support\Facades\Auth::login($user);

        return response()->json([
            'token' => $user->createToken($request->device_name)->plainTextToken
        ]);
    }

    public function register(Request $request)
    {
        $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'email', 'max:255', 'unique:users'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'device_name' => ['required', 'string'],
            'username' => ['nullable', 'string', 'max:255', 'unique:users'],
        ]);

        // Generate username if not provided
        $username = $request->username ?? $this->generateUsername($request->name, $request->email);

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
        });

        $token = $user->createToken($request->device_name)->plainTextToken;

        // Trigger original Registered event
        event(new Registered($user));

        // Ensure session is started for web clients (if needed)
        \Illuminate\Support\Facades\Auth::login($user);

        return response()->json([
            'token' => $token,
            'user' => $user,
            'message' => 'Registration successful! Check your email for verification code.',
            'requires_verification' => true,
            'verification_method' => 'code', // Indicate code-based verification
            'user_id' => $user->id
        ], 201);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->noContent();
    }

    public function verifyEmailCode(Request $request)
    {
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
    }

    public function resendVerificationCode(Request $request)
    {
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
        });

        return response()->json([
            'message' => 'New verification code sent!',
            'user_id' => $user->id
        ]);
    }

    public function forgotPassword(Request $request)
    {
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
        });

        return response()->json([
            'message' => 'Reset code sent to your email.',
            'email' => $user->email
        ]);
    }

    public function verifyResetCode(Request $request)
    {
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
    }

    public function resetPassword(Request $request)
    {
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
    }

    private function generateUsername($name, $email)
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
}