<?php
// Load Laravel
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$spaceId = "529537ba-5a35-4307-9f05-ad98fe4f4956";
$user = App\Models\User::find(12);
Auth::login($user);

// Create poll
$request = Request::create("/api/spaces/$spaceId/polls", 'POST', [
    'question' => 'Multiple choice test',
    'type' => 'multiple',
    'options' => [
        ['text' => 'Opt 1'],
        ['text' => 'Opt 2']
    ],
    'settings' => [
        'allowMultipleVotes' => true,
        'allowVoteChange' => true,
        'showResults' => 'always',
        'anonymous' => false,
        'weightedVoting' => false
    ]
]);
$response = app()->handle($request);
$data = json_decode($response->getContent(), true);

if (!isset($data['poll']['id'])) {
    die("Failed to create poll: " . $response->getContent());
}

$pollId = $data['poll']['id'];
$opt1 = $data['poll']['options'][0]['id'];
$opt2 = $data['poll']['options'][1]['id'];

echo "Created poll: $pollId\n";

// Vote on poll
$voteRequest = Request::create("/api/spaces/$spaceId/polls/$pollId/vote", 'POST', [
    'option_ids' => [$opt1, $opt2]
]);
$voteResponse = app()->handle($voteRequest);

echo "Vote Response:\n" . $voteResponse->getContent() . "\n";
