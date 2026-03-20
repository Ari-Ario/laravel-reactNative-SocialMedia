<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\User;
use App\Models\ModerationReport;
use App\Models\Comment;
use App\Http\Controllers\ModerationAdminController;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$admin = User::find(13);
$report = ModerationReport::where('report_id', 'REP-8LVE-6840')->first();

if (!$report) {
    echo "Report REP-8LVE-6840 not found.\n";
    exit(1);
}

echo "Resolving Comment Report: {$report->report_id} (Target Comment: {$report->target_id})...\n";

$request = new Request([
    'action' => 'warn',
    'notes' => 'TEST: Warning user for offensive content in comment.',
]);

auth()->login($admin);

$controller = app(ModerationAdminController::class);
try {
    $response = $controller->resolve($request, $report->report_id);
    echo "Response Status: " . $response->getStatusCode() . "\n";
    echo "Response Body: " . $response->getContent() . "\n";
    
    // Check target user ID from comment
    $comment = Comment::find($report->target_id);
    $creatorId = $comment->user_id;
    echo "Comment Creator ID: {$creatorId}\n";

    // Verify restriction for the creator
    $restriction = \App\Models\UserRestriction::where('user_id', $creatorId)->orderBy('created_at', 'desc')->first();
    if ($restriction) {
        echo "Restriction Created: ID {$restriction->id}, User {$restriction->user_id}, Type {$restriction->type}, Reason: {$restriction->reason}\n";
    } else {
        echo "Restriction NOT found.\n";
    }
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
