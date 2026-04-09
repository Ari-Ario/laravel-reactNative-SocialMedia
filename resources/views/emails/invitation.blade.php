<x-mail::message>
# You're Invited to Zmzir! ✨

Hello,

**{{ $inviterName }}** thinks you'd love Zmzir, the ultimate social platform for creators and friends.

@if($customMessage)
<x-mail::panel>
"{{ $customMessage }}"
</x-mail::panel>
@endif

Join a community where you can share moments, chat in real-time, and customize your digital world exactly how you want it.

<x-mail::button :url="$url">
Join Zmzir Now
</x-mail::button>

### Why join Zmzir?
*   **🔒 Privacy First**: You control who see your content.
*   **🎨 Elite Customization**: Profiles designed for expression.
*   **🚀 Real-time Interaction**: Instant messages and live updates.

We can't wait to see you there!

Best regards,<br>
The {{ config('app.name') }} Team
</x-mail::message>
