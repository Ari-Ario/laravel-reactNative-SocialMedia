<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

function T($msg) {
    echo "[" . microtime(true) . "] " . $msg . "\n";
}

$controller = new \App\Http\Controllers\ChatbotController();
$request = new \Illuminate\Http\Request();

T("Testing 'spaces'");
$request->merge(['message' => 'spaces', 'model' => 'phi-3']);
$response = $controller->handleMessage($request);
echo "Spaces Response Code: " . $response->getStatusCode() . "\n";
$data = json_decode($response->getContent(), true);
echo "Spaces Response Excerpt: " . substr(json_encode($data), 0, 100) . "...\n";

T("Testing 'collatz conjecture'");
$request2 = new \Illuminate\Http\Request();
$request2->merge(['message' => 'collatz conjecture', 'model' => 'phi-3']);
$response2 = $controller->handleMessage($request2);
echo "Collatz Response Code: " . $response2->getStatusCode() . "\n";
$data2 = json_decode($response2->getContent(), true);
echo "Collatz Response Excerpt: " . substr(json_encode($data2), 0, 100) . "...\n";

T("Done!");
