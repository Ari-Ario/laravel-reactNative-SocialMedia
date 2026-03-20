<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\User;
use App\Models\Post;
use App\Models\Comment;
use App\Models\Story;
use App\Models\Space;
use App\Http\Controllers\ReportController;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$reporter = User::find(1);
$targets = [
    ['type' => 'post', 'id' => 9, 'category' => 'ethical_violation', 'sub' => 'hate_speech'],
    ['type' => 'comment', 'id' => 6, 'category' => 'harassment', 'sub' => 'personal_attack'],
    ['type' => 'user', 'id' => 2, 'category' => 'impersonation', 'sub' => 'identity_theft'],
    ['type' => 'space', 'id' => '7a07d109-150a-497a-a8f1-c5d4f92e16fe', 'category' => 'misinformation', 'sub' => 'coordinated_deception'],
    ['type' => 'story', 'id' => 370, 'category' => 'scam', 'sub' => 'fraudulent_content'],
];

auth()->login($reporter);
$controller = app(ReportController::class);

echo "--- STARTING COMPREHENSIVE REPORTING TESTS ---\n\n";

foreach ($targets as $t) {
    echo "Testing Type: {$t['type']} (ID: {$t['id']})...\n";
    
    $request = new Request([
        'type' => $t['type'],
        'targetId' => $t['id'],
        'categoryId' => $t['category'],
        'subcategoryId' => $t['sub'],
        'description' => "EXTENSIVE TEST: Verification of {$t['type']} reporting flow.",
        'isAnonymous' => false,
        'isUrgent' => false,
    ]);

    try {
        $response = $controller->store($request);
        $data = json_decode($response->getContent(), true);
        
        if ($data['success']) {
            echo "✅ SUCCESS: Report {$data['reportId']} created. Severity: {$data['severity']}.\n";
            echo "   AI Analysis: Malicious Intent: " . ($data['ai_analysis']['malicious_intent_score'] ?? 'N/A') . "\n";
        } else {
            echo "❌ FAILED: " . ($data['message'] ?? 'Unknown error') . "\n";
        }
    } catch (\Exception $e) {
        echo "🔥 ERROR: " . $e->getMessage() . "\n";
    }
    echo "\n";
}

echo "--- TESTS COMPLETED ---\n";
