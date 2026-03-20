<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\User;
use App\Models\ModerationReport;
use App\Models\Story;
use App\Http\Controllers\ModerationAdminController;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$admin = User::find(13);
$report = ModerationReport::where('report_id', 'REP-JSNY-6339')->first();

if (!$report) {
    echo "Report REP-JSNY-6339 not found.\n";
    exit(1);
}

echo "Resolving Story Report: {$report->report_id} (Target Story: {$report->target_id})...\n";

$request = new Request([
    'action' => 'warn',
    'notes' => 'TEST: Warning user for misinformation in story.',
]);

auth()->login($admin);

$controller = app(ModerationAdminController::class);
try {
    $response = $controller->resolve($request, $report->report_id);
    echo "Response Status: " . $response->getStatusCode() . "\n";
    echo "Response Body: " . $response->getContent() . "\n";
    
    // Verify restriction for User 11 (creator of story 370)
    $restriction = \App\Models\UserRestriction::where('user_id', 11)->orderBy('created_at', 'desc')->first();
    if ($restriction) {
        echo "Restriction Created: ID {$restriction->id}, User {$restriction->user_id}, Type {$restriction->type}, Reason: {$restriction->reason}\n";
    } else {
        echo "Restriction NOT found.\n";
    }
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
