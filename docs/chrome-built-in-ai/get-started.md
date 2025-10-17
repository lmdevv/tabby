# Get started with built-in AI

## Get started with built-in AI

![Alexandra Klepper](https://web.dev/images/authors/alexandraklepper.jpg)

Published: December 12, 2024, Last updated: May 20, 2025

With [built-in AI APIs](/docs/ai/built-in-apis), your web application can perform AI-powered tasks without needing to deploy or manage its own AI models. We are working to [standardize these APIs across browsers](#standards_process).

## Requirements

To use built-in AI, there are model and hardware requirements.

### Models

The Translator and Language Detector APIs use expert models. All other APIs use a language model, designed to run locally on desktops and laptops.

The Summarizer API, Writer API, Rewriter API, and Proofreader API, only support text-to-text modality. The [Prompt API has multimodal capabilities](/blog/ai-api-updates-io25#prompt_api_multimodal).

#### Gemini Nano in Chrome

Chrome uses the Gemini Nano language models. Gemini Nano is not available on mobile devices.

From Chrome 140, Gemini Nano supports English, Spanish, and Japanese for input and output text.

Before you use the built-in AI APIs, acknowledge [Google's Generative AI Prohibited Uses Policy](https://policies.google.com/terms/generative-ai/use-policy).

### Hardware

The following requirements exist for developers and the users who operate features using these APIs in Chrome. Other browsers may have different operating requirements.

The Language Detector and Translator APIs work in Chrome on desktop. These APIs do not work on mobile devices. The Prompt API, Summarizer API, Writer API, Rewriter API, and Proofreader API work in Chrome when the following conditions are met:

-   **Operating system**: Windows 10 or 11; macOS 13+ (Ventura and onwards); Linux; or ChromeOS (from Platform 16389.0.0 and onwards) on [Chromebook Plus](https://www.google.com/chromebook/chromebookplus/) devices. Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported by the APIs which use Gemini Nano.
-   **Storage**: At least 22 GB of free space on the volume that contains your Chrome profile.
-   **GPU or CPU**: Built-in models can run with GPU or CPU.
    -   **GPU**: Strictly more than 4 GB of VRAM.
    -   **CPU**: 16 GB of RAM or more and 4 CPU cores or more.
-   **Network**: Unlimited data or an unmetered connection.

Gemini Nano's exact size may vary as the browser updates the model. To determine the current size, visit `chrome://on-device-internals`.

## Start building

There are [several built-in AI APIs available](/docs/ai/built-in-apis) at different stages of development. Some are in Chrome stable, some are available participants of origin trials, and others are only available to [Early Preview Program participants](/docs/ai/join-epp).

Each API has its own set of instructions to get started and download the model, both for local prototyping and in production environments with the origin trials.

-   [Translator API](/docs/ai/translator-api)
-   [Language Detector API](/docs/ai/language-detection)
-   [Summarizer API](/docs/ai/summarizer-api)
-   [Writer API](/docs/ai/writer-api) and [Rewriter API](/docs/ai/rewriter-api)
-   [Proofreader API](/docs/ai/proofreader)
-   [Prompt API](/docs/ai/prompt-api)

All of these APIs can be used when building Chrome Extensions.

### Model download

APIs are built into Chrome, as are the models. The first time a user interacts with these APIs, the model must be downloaded to the browser.

To determine if an API is usable and ready, call the asynchronous `availability()` function, which returns a promise with one of the following values:

-   `"unavailable"`: The user's device or requested session options are not supported. The device may have insufficient power or disk space.
-   `"downloadable"`: Additional downloads are needed to create a session, which may include an expert model, a language model, or fine-tuning. [User activation](#user-activation) may be required to call `create()`.
-   `"downloading"`: Downloads are ongoing and must complete before you can use a a session.
-   `"available"`: You can create a session immediately.

### User activation

If the device could support the built-in AI APIs, but the model is not yet available, a user interaction is required to start a session with `create()`.

Use the [`UserActivation.isActive`](https://developer.mozilla.org/docs/Web/API/UserActivation) property to confirm a user activation, which could be a click, tap, or key press.

```
// Check for user activation.
if (navigator.userActivation.isActive) {
  // Create an instance of a built-in API
}
```

For example with the [Summarizer API](/docs/ai/summarizer-api), you could ask users to interact with button that says "Summarize" to activate `Summarizer.create()`.

### Use APIs on localhost

All of the APIs are available on `localhost` in Chrome.

1.  Go to `chrome://flags/#prompt-api-for-gemini-nano-multimodal-input`.
2.  Select **Enabled**.
3.  Click **Relaunch** or restart Chrome.

To confirm Gemini Nano has downloaded and works as intended, open DevTools and type `await LanguageModel.availability();` into the console. This should return `available`.

#### Troubleshoot localhost

If the model doesn't work as expected, follow these steps:

1.  Restart Chrome.
2.  Go to `chrome://on-device-internals`.
3.  Select the **Model Status** tab and make sure there are no errors.
4.  Open DevTools and type `LanguageModel.availability();` into the console. This should return `available`.

If necessary, wait for some time and repeat these steps.

## Standards process

We're working to [standardize these APIs](https://www.w3.org/standards/about/), so that they work across all browsers. This means we have proposed the APIs to the web platforms community, and moved them to the [W3C Web Incubator Community Group](https://wicg.io/) for further discussion.

We are requesting feedback from the W3C, Mozilla, and WebKit for each API.

If you try built-in AI and have feedback, we'd love to hear it.

-   Discover all of the [built-in AI APIs](/docs/ai/built-in-apis).
-   [Join the Early Preview Program](/docs/ai/join-epp) for an early look at new APIs and access to our mailing list.
-   If you have feedback on Chrome's implementation, file a [Chromium bug](https://issues.chromium.org/issues/new?component=1583300&priority=P2&type=bug&template=0&noWizard=true).
-   Learn about [web standards](https://www.w3.org/standards/about/).

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2024-05-20 UTC.