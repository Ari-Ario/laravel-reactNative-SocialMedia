<?php
require 'vendor/autoload.php';
$app = require 'bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "--- DB CLEANUP ---\n";
$axioms = \Illuminate\Support\Facades\DB::table('knowledge_axioms')
    ->where('domain_partition', 'social_science_partition')
    ->get();
    
$deleted = 0;
foreach ($axioms as $a) {
    if (strpos($a->branch, '(') !== false && strpos($a->branch, '_') !== false) {
        echo "Deleting ID: {$a->id}, Branch: {$a->branch}, Thesis: {$a->thesis_statement}\n";
        \Illuminate\Support\Facades\DB::table('knowledge_axioms')->where('id', $a->id)->delete();
        $deleted++;
    }
}
echo "Deleted $deleted garbage axioms.\n\n";

echo "--- FILE CLEANUP (Git Untracked) ---\n";
$directory = __DIR__;

// Files to explicitly preserve
$preserve = [
    'delete_garbage.php',
    'preload.php',
    'artisan',
    'server.php',
    'index.php'
];

$deletedFiles = 0;

// Get all untracked files using Git
exec("git ls-files --others --exclude-standard", $untrackedFiles);

foreach ($untrackedFiles as $relativePath) {
    $path = $directory . '/' . $relativePath;
    $fileName = basename($path);

    // Criteria for garbage files
    $isTestPhp = (strpos($fileName, 'test_') === 0 || strpos($fileName, '_test.php') !== false || strpos($fileName, 'test.php') !== false) && substr($fileName, -4) === '.php';
    $isTestJs = (strpos($fileName, 'test_') === 0 || strpos($fileName, 'test.') === 0) && substr($fileName, -3) === '.js';
    $isTxtOut = in_array($fileName, ['out.txt', 'test_output.txt', 'router_test_results.txt', 'test.txt']);
    $isBakOrPy = in_array($fileName, ['fix_readme.py', 'AI_ECOSYSTEM_INTEGRATION.md.bak']) || substr($fileName, -4) === '.bak';
    $isScratch = strpos($relativePath, 'scratch/') !== false;

    if (($isTestPhp || $isTestJs || $isTxtOut || $isBakOrPy || $isScratch) && !in_array($fileName, $preserve)) {
        if (file_exists($path)) {
            echo "Deleting untracked garbage: $relativePath\n";
            unlink($path);
            $deletedFiles++;
        }
    }
}

echo "Deleted $deletedFiles garbage files.\n";
