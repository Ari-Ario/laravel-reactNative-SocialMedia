<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

use App\Models\User;
use App\Models\Story;
use App\Http\Controllers\ReportController;
use Illuminate\Http\Request;

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$reporter = User::find(1);
$storyId = 370;
$story = Story::find($storyId);

if (!$story) {
    echo "Story {$storyId} not found.\n";
    exit(1);
}

echo "Reporting Story: {$story->id} (Caption: {$story->caption})...\n";

$request = new Request([
    'type' => 'story',
    'targetId' => $story->id,
    'categoryId' => 'information_integrity',
    'subcategoryId' => 'misinformation',
    'description' => 'TEST: This story contains medical misinformation.',
    'isAnonymous' => false,
    'isUrgent' => true,
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
