<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Password;
use Inertia\Inertia;
use Inertia\Response;

use Illuminate\Http\JsonResponse;


class PasswordResetLinkController extends Controller
{
    /**
     * Show the password reset link request page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/forgot-password', [
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming password reset link request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): JsonResponse
    {
        \Log::info('Password reset request received for email: ' . $request->email);

        $request->validate([
            'email' => 'required|email',
        ]);

        $status = Password::sendResetLink(
            $request->only('email')
        );

        if ($status === Password::RESET_LINK_SENT) {
            return response()->json([
                'status' => __($status)
            ], 200);
        }

        return response()->json([
            'error' => __($status)
        ], 422);
    }

    //Orginal function of store here
    // public function store(Request $request): RedirectResponse
    // {
    //     $request->validate([
    //         'email' => 'required|email',
    //     ]);

    //     Password::sendResetLink(
    //         $request->only('email')
    //     );

    //     return back()->with('status', __('A reset link will be sent if the account exists.'));
    // }
}
