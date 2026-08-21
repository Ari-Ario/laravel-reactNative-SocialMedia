<?php

return [
    [
        'branch' => 'formal_logic',
        'thesis' => 'Major: All mammals are warm-blooded. Minor: A dog is a mammal. Conclusion: A dog is warm-blooded.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'formal_logic',
        'thesis' => 'Major Premise: Modus Ponens is valid. Minor Premise: This is Modus Ponens. Conclusion: This is valid.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'formal_logic',
        'thesis' => 'Major Premise: All humans are mortal. Minor Premise: Socrates is human. Conclusion: Socrates is a philosopher.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'biology',
        'thesis' => 'Trial 1: Crow 1 is black. Trial 2: Crow 2 is black. Conclusion: All crows are black.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'sociology',
        'thesis' => 'Trial 1: Rome fell due to inflation. Trial 2: Weimar fell due to inflation. Conclusion: Inflation always destroys societies.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'physics',
        'thesis' => 'energy conservation',
        'expected_status' => 'global_axiom',
    ],
    [
        'branch' => 'chemistry',
        'thesis' => 'stoichiometry',
        'expected_status' => 'global_axiom',
    ],
    [
        'branch' => 'empirical_science',
        'thesis' => 'Trial 1: This Apple is red. Trial 2: That Apple is red. Conclusion: All Apples are red.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'empirical_science',
        'thesis' => 'Trial 1: This Car is fast. Trial 2: That Car is fast. Conclusion: All Cars are fast.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'empirical_science',
        'thesis' => 'Trial 1: This Tree is tall. Trial 2: That Tree is tall. Conclusion: All Trees are tall.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'empirical_science',
        'thesis' => 'Trial 1: This Planet is round. Trial 2: That Planet is round. Conclusion: All Planets are round.',
        'expected_status' => 'synthesized_thesis',
    ],
    [
        'branch' => 'empirical_science',
        'thesis' => 'Trial 1: This Star is bright. Trial 2: That Star is bright. Conclusion: All Stars are bright.',
        'expected_status' => 'synthesized_thesis',
    ],
];
