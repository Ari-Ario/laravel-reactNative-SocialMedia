<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\User;
use App\Models\ModerationReport;
use App\Http\Controllers\ModerationAdminController;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$admin = User::where('is_admin', 1)->first();
auth()->login($admin);
$controller = app(ModerationAdminController::class);

$resolutions = [
    ['id' => 'REP-TCRT-2576', 'action' => 'dismiss', 'notes' => 'False positive, scientific discussion.'],
    ['id' => 'REP-TUYH-4499', 'action' => 'warn', 'notes' => 'Rude behavior, first warning.'],
    ['id' => 'REP-S0PK-8981', 'action' => 'suspend', 'notes' => 'Repeated violations, 24h suspension.', 'duration' => 24],
    ['id' => 'REP-D2LP-6439', 'action' => 'ban', 'notes' => 'Severe policy violation: Illegal content distribution.'],
    ['id' => 'REP-EIHS-1403', 'action' => 'warn', 'notes' => 'Inappropriate content in story.'],
];

echo "--- STARTING ADMIN RESOLUTION TESTS ---\n\n";

foreach ($resolutions as $res) {
    echo "Resolving Report: {$res['id']} with Action: {$res['action']}...\n";
    
    $request = new Request([
        'action' => $res['action'],
        'notes' => $res['notes'],
        'duration_hours' => $res['duration'] ?? null,
    ]);

    try {
        $response = $controller->resolve($request, $res['id']);
        $data = json_decode($response->getContent(), true);
        
        if (isset($data['success']) && $data['success']) {
            echo "✅ RESOLVE SUCCESS: " . $data['message'] . "\n";
            
            // Verify restriction if applied
            $report = ModerationReport::where('report_id', $res['id'])->first();
            if ($res['action'] !== 'dismiss') {
                echo "   Target Type: {$report->target_type}, ID: {$report->target_id}\n";
            }
        } else {
            echo "❌ RESOLVE FAILED: " . json_encode($data) . "\n";
        }
    } catch (\Exception $e) {
        echo "🔥 ERROR: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

echo "--- TESTS COMPLETED ---\n";
