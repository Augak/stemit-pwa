# Android engine test plan

Use this plan after a real model and runtime bundle are added.

## Device checks

Record Android version, RAM, browser version and free storage. Test at minimum on:

- one lower-end Android phone;
- one 4 GB RAM phone;
- one newer reference phone.

## Test cases

1. Open Stemit offline after the app shell has been cached.
2. Import a short WAV file.
3. Run model preflight.
4. Run separation on 10 seconds of audio.
5. Run separation on 30–60 seconds of audio.
6. Cancel or leave the page during processing and reopen it.
7. Export vocals and instrumental output.
8. Verify that no audio request leaves the device.
9. Repeat with TalkBack enabled and large text.
10. Record completion time, peak memory symptoms, crashes and audible artifacts.

## Release rule

Do not enable AI mode for general users until the candidate model passes all test cases on a physical Android device. If the device kills the tab or the browser becomes unresponsive, reduce model size or add chunked overlap processing before release.
