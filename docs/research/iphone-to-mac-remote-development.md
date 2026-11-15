# iPhone-to-Mac remote development research

Research date: 2026-11-14 (Asia/Manila)

## Recommendation

Use a layered setup rather than trying to force every task through a tiny remote desktop:

1. **Primary agent control:** use each provider's own mobile interface for conversations, progress, approvals, diffs, and follow-ups.
2. **Private network and recovery path:** install **Tailscale** on the iPhone and Mac.
3. **Universal terminal:** use **Termius Starter** on the iPhone to SSH to the Mac, and keep CLI agents and dev servers in named **tmux** sessions.
4. **Phone browser preview:** expose only the needed localhost dev-server port with **Tailscale Serve**, then open its private HTTPS URL in Safari.
5. **Full desktop fallback:** install **Chrome Remote Desktop** for the simplest zero-cost option, or **RustDesk** if open source/self-hosting is more important.

This gives the best phone experience for normal work while retaining terminal and full-GUI escape hatches. It also avoids publishing SSH, VNC, OpenCode, or development-server ports to the public internet.

The networking and helper apps below can be free, but the AI providers still apply the limits of the user's existing Claude, Cursor, ChatGPT/Codex, and model-provider subscriptions.

## Provider-specific mobile support

| Provider     | Best phone interface                                                                     | Runs against local Mac?                                                                                                                                                                             | Important limits                                                                                                                                                                                                                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Code  | Claude iOS app, **Code** tab, or `claude.ai/code`                                        | Yes. `claude remote-control` can serve new local sessions; `claude --remote-control` or `/remote-control` exposes an existing one. Filesystem, tools, MCP servers, and execution remain on the Mac. | Requires Pro, Max, Ultra, Team, or Enterprise login, not an API key. The Mac and process must remain online. Remote transcripts are stored by Anthropic while connected. [Official Remote Control docs](https://code.claude.com/docs/en/remote-control)                                                                         |
| Cursor       | Native Cursor iOS app; `cursor.com/agents` PWA is the compatibility option               | Yes. Cursor Remote Control moves the agent loop to Cursor's cloud while terminal commands, edits, tests, and Git operations run on the Mac.                                                         | Native app currently requires iOS 26+ and an eligible paid/legacy plan. Mac must stay awake. Web/mobile cloud agents use background-agent pricing. [Cursor iOS and Remote Control docs](https://cursor.com/docs/cloud-agent/mobile), [web/mobile docs](https://docs.cursor.com/en/background-agent/web-and-mobile)              |
| OpenAI Codex | ChatGPT iOS app, **Remote** tab                                                          | Yes. The mobile app loads live Mac-host state and can start/continue threads, approve actions, switch models, and inspect terminal output, screenshots, diffs, and test results.                    | Preview is rolling out across all plans, including Free and Go; requires an updated ChatGPT mobile app and Codex macOS app. Host must stay awake and online. [OpenAI announcement](https://openai.com/index/work-with-codex-from-anywhere/), [release notes](https://help.openai.com/en/articles/6825453-chatgpt-release-notes) |
| OpenCode     | OpenCode mobile app (currently linked as Apple TestFlight) or its built-in mobile web UI | Yes. OpenCode's local background server owns its sessions; `opencode pair` creates a one-use link and QR code, and sessions last 30 days.                                                           | The app is not yet presented as a normal App Store release. Its server is localhost-only by default. Use OpenCode's E2E-encrypted `opencode pair --remote`, or keep it private behind Tailscale. [OpenCode Web docs](https://opencode.ai/docs/cli/web), [OpenCode product page](https://opencode.ai/)                           |

### Why provider-native control should be primary

It preserves readable conversations and purpose-built controls on a small screen. In particular:

- Claude shows the synchronized transcript, local changes, subagents, permission prompts, and workflows. Its local connection is outbound HTTPS only and opens no inbound port. [Claude security details](https://code.claude.com/docs/en/remote-control#connection-and-security)
- Cursor mobile can follow local or cloud agents, send follow-ups, review pull requests, and receive completion notifications. Its mobile app is a controller/reviewer rather than a full IDE. [Cursor mobile docs](https://cursor.com/docs/cloud-agent/mobile)
- Codex mobile is explicitly designed as an engineering control plane, including approvals, attachments, worktrees, goals, terminal output, screenshots, diffs, and tests. [OpenAI mobile workflow guide](https://developers.openai.com/blog/mastering-codex-remote-for-engineering)
- OpenCode's web UI uses the same server and sessions as its TUI, so it is substantially better than reading the TUI through a remote desktop. [OpenCode Web docs](https://opencode.ai/docs/cli/web)

## Free foundation

### Tailscale: recommended private network

Tailscale Personal is currently **$0**, supports up to six users and unlimited user devices, and includes core connectivity and access controls. It uses WireGuard end-to-end encryption, including when traffic must traverse a Tailscale relay. [Current pricing](https://tailscale.com/pricing), [security architecture](https://tailscale.com/security)

Install it on both devices and sign into the same personal tailnet. Tailscale supports iPhone/iPad, and MagicDNS gives the Mac a stable name such as `macbook-pro` regardless of the networks used while traveling. [iOS installation](https://tailscale.com/docs/install/ios), [MagicDNS](https://tailscale.com/docs/features/magicdns)

Why it is preferable here:

- no router port forwarding;
- no public SSH/VNC/dev-server address;
- stable private name/IP while the home ISP address changes;
- one private network for SSH, OpenCode, browser previews, and optional VNC;
- access-control policies are available on the Personal plan.

Alternatives:

- **ZeroTier Personal** is also free, but the current allowance is 10 devices. It is reasonable if already in use, but Tailscale's identity login, MagicDNS, Serve, and documentation make this particular setup simpler. [ZeroTier pricing](https://www.zerotier.com/pricing/)
- **Raw WireGuard** is free and excellent, but requires substantially more manual key, endpoint, DNS, NAT, and router management. It offers no advantage for a one-Mac/one-iPhone travel setup unless the user specifically wants to own all networking infrastructure.

### Termius Starter: recommended free SSH client

Termius is free to download on iPhone. Its current Starter plan is free, including SSH, SFTP, Mosh, port forwarding, a local vault, and biometric/PIN locking; paid Pro is mainly needed for cross-device sync, snippets, and session logs. [Termius pricing](https://www.termius.com/pricing), [App Store listing](https://apps.apple.com/us/app/termius-modern-ssh-client/id549039908)

On the Mac, enable **System Settings → General → Sharing → Remote Login**, allow only the intended account, and do not enable full-disk access unless actually needed. Apple documents Remote Login as SSH/SFTP access. [Apple Remote Login guide](https://support.apple.com/guide/mac-help/allow-a-remote-computer-to-access-your-mac-mchlp1066/mac)

Use the Tailscale/MagicDNS host name in Termius. Do not port-forward TCP 22 on the router. Prefer an SSH key protected by the iPhone's biometric/app lock over a reusable Mac password.

### tmux: session continuity for every CLI agent

`tmux` keeps programs alive when the iPhone changes networks, locks, or loses its SSH connection. Its official documentation describes detached programs continuing in the background and later reattaching from another terminal. [tmux getting started](https://github.com/tmux/tmux/wiki/Getting-Started)

Example layout:

```bash
tmux new -s claude
tmux new -s codex
tmux new -s opencode
tmux new -s dev
```

Useful commands:

```bash
tmux ls
tmux attach -t claude
tmux attach -t codex
tmux attach -t opencode
tmux attach -t dev
```

Start local-agent CLIs and long-running servers inside their corresponding session. Native mobile control remains more comfortable, but tmux is the universal fallback when a provider-specific relay is unavailable or a raw shell command is needed.

## Viewing and testing the UI from the iPhone

### Best phone-browser path: Tailscale Serve

Keep the development server bound to localhost, then proxy only its port to the private tailnet:

```bash
# Example when the local UI is at http://127.0.0.1:5173
tailscale serve 5173
```

Tailscale prints a private HTTPS `*.ts.net` address. Open that URL in Safari while Tailscale is connected on the iPhone. Serve is available only inside the tailnet and applies its access-control rules; unlike Funnel, it does not publish the site to the public internet. [Tailscale Serve docs](https://tailscale.com/docs/features/tailscale-serve), [development-server example](https://tailscale.com/docs/use-cases/application-testing/share-local-dev-server-with-team)

This is safer than binding a Vite dev server to every interface. Vite defaults to localhost, and its own docs warn that overly broad host settings can create DNS-rebinding/source exposure risk. [Vite server options](https://vite.dev/config/server-options)

Use Safari to validate the real phone layout and touch behavior. Use full remote desktop when the goal is to inspect desktop Chrome, DevTools, or another native application.

### Optional browser IDE: VS Code Remote Tunnels

`code tunnel` can expose the Mac's VS Code Server through an authenticated `vscode.dev` URL without opening an inbound firewall port. It supports a browser editor, terminal, extensions, and a service/no-sleep mode. Both ends authenticate with the same GitHub or Microsoft account. [VS Code Remote Tunnels](https://code.visualstudio.com/docs/remote/tunnels/)

This is useful on an iPad or with an external keyboard. On an iPhone, provider-native agent UI plus Termius is generally more usable than a full browser IDE. It also does not replace Cursor's own sessions or UI.

## Full-desktop options

| Option                                      | Cost/use restriction                                                                                                                                                                                                                                                                | iPhone → Mac and unattended use                                                                                                                                                                                                                                                                                                                                                                 | Assessment                                                                                                                                                                        |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Chrome Remote Desktop**                   | No paid tier is presented for the remote-access product                                                                                                                                                                                                                             | Official iPhone instructions support Mac remote access using a saved host and PIN; sessions are fully encrypted. [Google setup guide](https://support.google.com/chrome/answer/1649523?co=GENIE.Platform%3DiOS&hl=en)                                                                                                                                                                           | **Simplest fallback.** Easy setup, good for Cursor GUI, browser DevTools, or fixing a stopped process. Less configurable and relies on Google's relay/service.                    |
| **RustDesk**                                | Client and OSS self-hosted server are open source; the OSS server is free. [OSS server docs](https://rustdesk.com/docs/en/self-host/)                                                                                                                                               | iOS is a controller for macOS. Permanent password + installed service/helper enables unattended access; macOS requires Accessibility and Screen Recording, sometimes Input Monitoring. [iOS/client support](https://rustdesk.com/docs/en/client/), [Mac permissions](https://rustdesk.com/docs/en/client/mac/), [unattended setup](https://rustdesk.com/blog/rustdesk-unattended-access-setup/) | **Best open-source/control option.** Public RustDesk infrastructure is easiest; a self-hosted server gives more ownership but creates an additional server to operate and secure. |
| **macOS Screen Sharing/VNC over Tailscale** | Built into macOS; an iOS VNC client may cost money or have limitations                                                                                                                                                                                                              | macOS Screen Sharing is VNC-compatible and can permit control. It should be reachable only over Tailscale, never public port forwarding. [Apple Screen Sharing docs](https://support.apple.com/en-au/guide/mac-help/mh11848/mac)                                                                                                                                                                | Viable and private, but no first-party Apple iPhone Screen Sharing client. It is not the cleanest strict-$0 route unless a suitable free VNC iOS client is already owned.         |
| **AnyDesk**                                 | Free only for personal, non-commercial use. Any work/business/professional activity requires a license, and AnyDesk may suspend free service if usage looks commercial. [Terms](https://anydesk.com/en/terms), [commercial-use definition](https://anydesk.com/en/professional-use) | iOS can make outgoing connections and Mac supports unattended passwords.                                                                                                                                                                                                                                                                                                                        | **Do not rely on the free license for SaaS/development work.** The license condition conflicts with the stated use case if the work is professional or business-related.          |
| **TeamViewer**                              | Free only for personal, non-commercial use; its EULA excludes use in one's trade, business, or profession. [EULA](https://www.teamviewer.com/en-us/legal/eula/)                                                                                                                     | iPhone can control a Mac and TeamViewer documents unattended access. [Mac access](https://www.teamviewer.com/cn/solutions/use-cases/remote-access/mac/)                                                                                                                                                                                                                                         | Same concern as AnyDesk. Fine for truly personal home access, but **not a dependable free choice for professional development**.                                                  |

For strict zero-cost work use, choose Chrome Remote Desktop or RustDesk, not AnyDesk/TeamViewer.

## Concrete setup checklist

### Before traveling

1. Update macOS, the AI desktop/CLI tools, and all iPhone apps.
2. Install Tailscale on Mac and iPhone using the same personal account; enable MFA on the identity provider.
3. Confirm the Mac's MagicDNS name from Tailscale.
4. Enable macOS Remote Login for only the development account.
5. Install Termius; create/import a dedicated SSH key; save the Mac using its MagicDNS name.
6. Install tmux and create named sessions for Claude, Codex, OpenCode, and the local development stack.
7. Enable each native agent route:
   - Claude: run `claude remote-control --name "Kame Homes"` or enable Remote Control on the active session.
   - Cursor: update Cursor, enable Remote Control in the Agents Window, then verify the local session appears in the Cursor iOS app or web PWA.
   - Codex: enable/discover the Mac in Codex's connection settings, pair it by QR code with the ChatGPT mobile app, and verify the Remote tab.
   - OpenCode: start its background service, then use `opencode pair`; for travel, use `opencode pair --remote`, or proxy the localhost port privately with Tailscale Serve and create a pair link for that URL.
8. Install and test Chrome Remote Desktop or RustDesk as the GUI fallback. Grant all requested macOS permissions while physically present.
9. Plug in the Mac and enable **Prevent automatic sleeping on power adapter when the display is off**. Apple documents this under Battery → Options. [Apple sleep settings](https://support.apple.com/en-sg/guide/mac-help/mchle41a6ccd/mac)
10. Keep the lid open unless a known-working supported clamshell setup is attached. Avoid scheduling OS restarts while away.
11. Start the local app inside tmux. If the UI listens on localhost, run `tailscale serve <port>` and bookmark the resulting private HTTPS URL on the iPhone.
12. Perform a real rehearsal with iPhone Wi-Fi disabled, using cellular data. Test all four provider apps, SSH reconnection, Safari preview, and full desktop control.

### Daily remote workflow

1. Open the provider's native mobile UI to check agents and respond to questions.
2. Use Safari through Tailscale Serve to test the actual phone UI.
3. Use Termius → tmux for arbitrary commands, logs, Git status, or restarting the dev stack.
4. Use Chrome Remote Desktop/RustDesk only when a task truly needs desktop Cursor, Chrome DevTools, Finder, System Settings, or a visual recovery.

## Security and reliability guardrails

- Do not expose SSH (22), VNC (5900), Vite, Supabase, or OpenCode directly through router port forwarding.
- Do not use Tailscale Funnel for this workflow; Serve keeps the site private to the tailnet.
- Use MFA for Tailscale's identity account and every AI-provider account. Protect the iPhone with Face ID and a strong device passcode.
- Use SSH keys and restrict macOS Remote Login to one account. Keep a recovery key somewhere safe but not in the same phone notes/vault as the private key.
- Keep AI permission prompts enabled for destructive commands and production operations. Remote convenience should not mean blanket auto-approval.
- Prefer named worktrees/branches for simultaneous agents. Claude Remote Control itself offers `--spawn worktree`; avoid letting several agents edit one working directory concurrently. [Claude server modes](https://code.claude.com/docs/en/remote-control#start-a-remote-control-session)
- Be aware that "runs locally" does not mean "no cloud data": Claude stores the remote transcript while connected, Cursor sends necessary model context/tool results, and Codex synchronizes active state through its secure relay. Apply each provider's data controls to sensitive repositories.
- Configure two independent recovery paths. A practical minimum is provider-native remote control plus Termius/tmux; full desktop is the third path.
- Travel with the Mac plugged into reliable power, disable automatic sleep on power, and test after any macOS/provider update before leaving.

## Bottom line

The best current solution is **not one app**. It is:

> Claude app + Cursor app/PWA + ChatGPT Remote + OpenCode app/web, backed by Tailscale + Termius + tmux, with Tailscale Serve for browser previews and Chrome Remote Desktop or RustDesk for emergencies.

That stack is zero-cost beyond subscriptions already being paid, supports local commands and tests, preserves agent-session continuity, shows real UI changes on the iPhone, and still gives full Mac control when necessary.
