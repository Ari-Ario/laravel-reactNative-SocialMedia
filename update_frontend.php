<?php
$files = [
    'frontend/services/PusherService.ts',
    'frontend/services/ChatScreen/RealTimeServiceChat.ts',
    'frontend/services/ChatScreen/CollaborationService.ts',
    'frontend/components/ChatScreen/UnifiedSpace.tsx'
];

foreach ($files as $file) {
    if (file_exists($file)) {
        $content = file_get_contents($file);

        // Channels
        $content = preg_replace('/(`private-user)\.\$\{([^}]+)\}`/', '$1-${$2}`', $content);
        $content = preg_replace('/(`presence-space)\.\$\{([^}]+)\}`/', '$1-${$2}`', $content);
        $content = preg_replace('/(\'private-user)\.(\'|")/', '$1-$2', $content);
        $content = preg_replace('/(\'presence-space)\.(\'|")/', '$1-$2', $content);
        $content = str_replace("'posts.global'", "'posts-global'", $content);
        $content = str_replace("'stories.global'", "'stories-global'", $content);

        // Bindings (.bind('a.b'))
        $content = preg_replace_callback("/\.bind\(\s*['\"]([a-zA-Z0-9_]+)\.([a-zA-Z0-9_\.]+)['\"]/", function ($matches) {
            return '.bind(\'' . $matches[1] . '-' . str_replace('.', '-', $matches[2]) . '\'';
        }, $content);

        // Object keys ('message.sent': ...)
        $content = preg_replace_callback("/\s*['\"]([a-zA-Z0-9_]+)\.([a-zA-Z0-9_\.]+)['\"]\s*:/", function ($matches) {
            $prefixes = ['message', 'webrtc', 'call', 'magic', 'space', 'participant', 'content', 'poll', 'mute', 'video', 'screen'];
            if (in_array($matches[1], $prefixes)) {
                $replacement = "'" . $matches[1] . "-" . str_replace('.', '-', $matches[2]) . "'";
                return str_replace("'" . $matches[1] . "." . $matches[2] . "'", $replacement, $matches[0]);
            }
            return $matches[0];
        }, $content);

        // Explicit edge cases
        $content = str_replace('user.left_space', 'user-left_space', $content);
        $content = str_replace('user.activity', 'user-activity', $content);
        $content = str_replace('screen_share.started', 'screen_share-started', $content);
        $content = str_replace('screen_share.ended', 'screen_share-ended', $content);
        $content = str_replace('violation.reported', 'violation-reported', $content);

        file_put_contents($file, $content);
        echo "Updated $file\n";
    }
}
