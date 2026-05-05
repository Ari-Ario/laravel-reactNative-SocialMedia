<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');
});

Route::get('media-proxy', function (Illuminate\Http\Request $request) {
    $path = $request->query('path');
    if (!$path) abort(400);
    
    // Clean path and ensure it's in storage
    $path = str_replace('storage/', '', $path);
    $file = storage_path('app/public/' . $path);
    
    if (!file_exists($file)) abort(404);
    
    $mime = mime_content_type($file);
    
    return response()->file($file, [
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET, OPTIONS',
        'Content-Type' => $mime,
    ]);
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
