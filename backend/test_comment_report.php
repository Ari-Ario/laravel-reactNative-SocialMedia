<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\User;
use App\Models\Comment;
use App\Http\Controllers\ReportController;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$reporter = User::find(1);
$commentId = 1;
$comment = Comment::find($commentId);

if (!$comment) {
    echo "Comment {$commentId} not found.\n";
    exit(1);
}

echo "Reporting Comment: {$comment->id} (Content: {$comment->content})...\n";

$request = new Request([
    'type' => 'comment',
    'targetId' => $comment->id,
    'categoryId' => 'ethical_violation',
    'subcategoryId' => 'targeted_insult',
    'description' => 'TEST: This comment is a personal attack.',
    'isAnonymous' => false,
    'isUrgent' => false,
    'metadata' => ['test' => true]
]);

auth()->login($reporter);

$controller = app(ReportController::class);
try {
    $response = $controller->store($request);
    echo "Response Status: " . $response->getStatusCode() . "\n";
    echo "Response Body: " . $response->getContent() . "\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
