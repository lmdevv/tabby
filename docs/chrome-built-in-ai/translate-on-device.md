# Client-side translation with AI

## Client-side translation with AI

![Maud Nalpas](https://web.dev/images/authors/maudn.jpg)

![Alexandra Klepper](https://web.dev/images/authors/alexandraklepper.jpg)

Published: May 16, 2024, Last updated: November 13, 2024

Explainer

Web

Extensions

Chrome Status

Intent

[MDN](https://developer.mozilla.org/docs/Web/API/Translator_and_Language_Detector_APIs)

![](/static/images/chrome_logo.svg) Chrome 138

![](/static/images/chrome_logo.svg) Chrome 138

[View](https://chromestatus.com/feature/5172811302961152)

[Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/eCE8jIW2auo/m/3vMI6eQqBAAJ)

Expanding your business into international markets can be expensive. More markets likely means more languages to support, and more languages can lead to challenges with interactive features and flows, such as after-sale support chat. If your company only has English-speaking support agents, non-native speakers may find it difficult to explain exactly what problem they've encountered.

How can we use AI to improve the experience for speakers of multiple languages, while minimizing risk and confirming if it's worth investing in support agents who speak additional languages?

Some users try to overcome the language barrier with their browser's built-in page translation feature or third-party tools. But the user experience is sub-par with interactive features, like our after-sale support chat.

For chat tools with integrated translation, it's important to minimize delays. By processing language on device, you can translate in real-time, before the user even submits the message.

That said, transparency is critical when bridging a language gap with automated tools. Remember, before the conversation starts, make it clear you've implemented AI tools which allow for this translation. This sets expectations and helps avoid awkward moments if the translation isn't perfect. Link out to your policy with more information.

We're working on a client-side [Translator API](/docs/ai/translator-api) with a model built into Chrome.

### Review the hardware requirements

The following requirements exist for developers and the users who operate features using these APIs in Chrome. Other browsers may have different operating requirements.

The Language Detector and Translator APIs work in Chrome on desktop. These APIs do not work on mobile devices. The Prompt API, Summarizer API, Writer API, Rewriter API, and Proofreader API work in Chrome when the following conditions are met:

-   **Operating system**: Windows 10 or 11; macOS 13+ (Ventura and onwards); Linux; or ChromeOS (from Platform 16389.0.0 and onwards) on [Chromebook Plus](https://www.google.com/chromebook/chromebookplus/) devices. Chrome for Android, iOS, and ChromeOS on non-Chromebook Plus devices are not yet supported by the APIs which use Gemini Nano.
-   **Storage**: At least 22 GB of free space on the volume that contains your Chrome profile.
-   **GPU or CPU**: Built-in models can run with GPU or CPU.
    -   **GPU**: Strictly more than 4 GB of VRAM.
    -   **CPU**: 16 GB of RAM or more and 4 CPU cores or more.
-   **Network**: Unlimited data or an unmetered connection.

Gemini Nano's exact size may vary as the browser updates the model. To determine the current size, visit `chrome://on-device-internals`.

## Demo chat

We've built a customer support chat which allows for users to type in their first language and receive real-time translation for the support agent.

## Use the Translator API

To determine if the Translator API is supported, run the following feature detection snippet.

```
if ('Translator' in self) {
  // The Translator API is supported.
}
```

### Check language pair support

Translation is managed with language packs, downloaded on demand. A language pack is like a dictionary for a given language.

-   `sourceLanguage`: The current language for the text.
-   `targetLanguage`: The final language the text should be translated into.

Use [BCP 47](https://www.rfc-editor.org/info/bcp47) language short codes as strings. For example, `'es'` for Spanish or `'fr'` for French.

Determine the [model availability](/docs/ai/language-detection#model_download) and listen for the `downloadprogress`:

```
const translator = await Translator.create({
  sourceLanguage: 'es',
  targetLanguage: 'fr',
  monitor(m) {
    m.addEventListener('downloadprogress', (e) => {
      console.log(`Downloaded ${e.loaded * 100}%`);
    });
  },
});
```

If the download fails, then `downloadprogress` events stop and the `ready` promise is rejected.

### Create and run the translator

To create a translator, call the asynchronous `create()` function. It requires an options parameter with two fields, one for the `sourceLanguage` and one for the `targetLanguage`.

```
// Create a translator that translates from English to French.
const translator = await Translator.create({
  sourceLanguage: 'en',
  targetLanguage: 'fr',
});
```

Once you have a translator, call the asynchronous `translate()` function to translate your text.

```
await translator.translate('Where is the next bus stop, please?');
// "Où est le prochain arrêt de bus, s'il vous plaît ?"
```

## Next steps

We want to see what you're building with the Translator API. Share your websites and web applications with us on [X](https://x.com/ChromiumDev), [YouTube](https://www.youtube.com/user/ChromeDevelopers), and [LinkedIn](https://www.linkedin.com/showcase/chrome-for-developers/).

You can [sign up for the Early Preview Program](/docs/ai/join-epp) to test this API and others with local prototypes.

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2024-11-13 UTC.