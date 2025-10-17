# The Summarizer API helps Bright Sites and Terra create engaging article summaries  |  Blog  |  Chrome for Developers

![Mari Viana](https://web.dev/images/authors/mviana.png)

![Thierno Thiam](https://web.dev/images/authors/thiernothiam.jpg)

Published: May 15, 2025

The public relies on news publishers to inform them of local, national, and international events, as well as share their thoughtful perspectives. In today's fast-paced environment, article summaries are a key strategy to condense complex information into accessible snippets, encouraging readers to explore further. Learn how Bright Sites and Terra approach this strategy using the Summarizer API.

Explainer

Web

Extensions

Chrome Status

Intent

[MDN](https://developer.mozilla.org/docs/Web/API/Summarizer/)

![](/static/images/chrome_logo.svg) Chrome 138

![](/static/images/chrome_logo.svg) Chrome 138

[View](https://chromestatus.com/feature/5193953788559360)

[Intent to Ship](https://groups.google.com/a/chromium.org/g/blink-dev/c/cpyB56aHWs4/m/8NTdmGV8AAAJ)

The [Summarizer API](/docs/ai/summarizer-api) lets you generate different types of summaries in varied lengths and formats, such as sentences, paragraphs, bullet point lists, and more. This API, like many of the [built-in AI APIs](/docs/ai/built-in-apis), use large language models to perform inference. In Chrome, our model is Gemini Nano.

## Bright Sites adds personalized article summaries to The Standard

[Bright Sites'](https://www.brightsites.co.uk/) leading news publishing platform, [Flow](https://www.brightsites.co.uk/flow), powers over 150 publications. By integrating the Summarizer API into its AI-powered CMS, Bright Sites enables [The Standard](https://www.standard.co.uk/), London's iconic news brand, to offer personalized summaries of articles to its readers. This encourages users to engage with articles and recirculate to other articles on The Standard.

> "Working with Gemini's cutting edge models in Chrome is bringing together The Standard's 198 years of heritage of keeping our readers in the know with new technical innovations for our busy audience who value having our trusted journalism at their fingertips. Enabling readers to quickly check the news using summaries built on their own devices is just one of the ways in which we're reimagining The Standard and building new reader-focused products around their digital habits."
> 
> — [Jack Riley](https://www.linkedin.com/in/jackodriley/), Chief Digital Officer, The Standard

Offering client-side AI summarization enabled The Standard to generate personalized summaries without incurring additional business cost. Doing so client-side, using data points like summary style or location, would allow users to continue reading even when they lose internet access. This is a frequent occurrence for many users who travel on the London Underground with their laptop.

First, they check for support and availability of the model and the API.

```
// Check if the device supports built-in AI
// Trigger the model download if not yet available, on capable devices
export const deviceCheck = async () => {
  const availability = await Summarizer.availability();
  if (!availability || availability === 'unavailable') {
    return {
      summarizationAvailable: false,
      message:
        "AI summarization tools are not supported on this device" +
        "or the appropriate permissions are not set.",
    }
  }
  if (availability === 'downloadable') {
    const shouldDownload = window.confirm(
      `This page contains an AI summary, using an AI model provided by your
      browser. Downloading the model, which could be multiple gigabytes in size,
      is required to view the summary. Would you like to download the model?`);

    if (!shouldDownload) {
      return {
        summarizationAvailable: false,
        message: "User declined installation.",
      }
    }

    // Trigger an installation
    Summarizer.create();
    return {
      summarizationAvailable: false,
      message: "Installing in the background. This may take a few minutes...",
    }
  }

  if (availability === 'available') {
    return {
      summarizationAvailable: true,
      message: "Ready for use.",
    }
  }
}
```

The following function defines a generic summarizer that, in the future, could use another on-device model or a server-side model.

```
/**
* Define the summarizer.
**/
export const aiSummarize = async (textToSummarize, options) => {
  const availableSummarizationTools = getAvailableAiSummarizationTools()

  if (availableSummarizationTools.has('builtInAi') && options?.builtInAI) {
    // Generate the built-in AI summarizer and abort signal
    const summarizer = await createBuiltInAISummarizer(options.builtInAi.options)
    return await summarizer.summarize(textToSummarize, {
      signal: options.builtInAi.signal,
    })
  }
  throw new Error(
    'AI summarization tools are not supported on this device or browser.',
  )
}
```

The Standard stores the readers' summary preference in IndexedDB to offer personalized summary.

```
/**
* Log preferences in IndexDB for personalization
**/
abortController.current = new AbortController()
const preferencesDB = new PreferencesDB()
const summarization = await aiSummarize(articleContent, {
 clientSideAI: {
   options: await preferencesDB.getCreatesummarizerPreferences(),
   signal: abortController.current.signal,
 },
})
```

## Terra provides journalists an editable summary for articles in Portuguese

[Terra](https://www.terra.com/) is one of the largest content portals from Brazil, offering entertainment, news, and sports with more than 50 million unique visitors per month. Terra added the Summarizer API and the Translator API to their content management system (CMS) to help journalists instantly summarize news stories in Portuguese. Journalists can then make a few edits for stylistic or accuracy purposes and publish the co-created summary, making it readily available to all readers.

While Terra's CMS already uses a server-side LLM, the team explored client-side AI as a distinct approach with potential new benefits. They found the [Summarizer API](/docs/ai/summarizer-api) and Gemini Nano in Chrome provided comparable quality to their server-side implementation. The client-side solution yielded positive results when used in conjunction with the [Translator API](/docs/ai/translator-api).

Terra adopted Chrome's implementation of built-in AI because of key advantages. Client-side AI offered cost savings and simplified data governance. While the team encountered some challenges, notably around [managing content window limitations](/docs/ai/scale-summarization) with the Summarizer API, they were able to overcome these through careful implementation practices.

Initially, Terra faced challenges in determining what [summary types](/docs/ai/summarizer-api#api-functions) and shared context were best equipped to address their needs. Through experimentation, they discovered that clear and useful English summaries were crucial for producing a similar quality output in Portuguese with the Translator API. The [built-in AI playground](https://chrome.dev/web-ai-demos/built-in-ai-playground/) was instrumental in navigating these challenges, as Terra could quickly test their ideas without refactoring their code each time.

The following sample demonstrates how Terra invokes the Summarizer API and alerts users when it's unavailable.

```
async function summarizerByBuiltInAI(text) {
  if (!(Summarizer)) {
    //Alert users in Portuguese that "Summarizer API is not available"
    cms_alert(ALERT_TYPE_ERROR, "Summarizer API não está disponível.")
    return null
  }

  try {
    const availability = await Summarizer.availability();
    if (availability !== 'available') {
      cms_alert(ALERT_TYPE_ERROR, "Summarizer API não está disponível.")
      return null 
    }

    const summaryContext = "Avoid jargon, use correct grammar, focus on clarity," +
    "and ensure the user can grasp the articles purpose," +
    "without needing to open the original content.";

    const options = {
      sharedContext: summaryContext,
      type: 'teaser',
      format: 'plain-text',
      length: 'long',
    }

    if (availability === 'available') {
      const summarizer = await Summarizer.create(options);
      return await summarizer.summarize(text, {
        context: summaryContext
      })
    }
    // return the download of the Summarizer Model
    if(availability === 'downloadable'){
      return await Summarizer.create();
    }
  } catch (error) {
    //EN: "Error using the Summarizer API"
    cms_alert(ALERT_TYPE_ERROR, "Erro ao usar o Summarizer API.");
    console.error("Erro ao usar o Summarizer API:", error);
    return null
  }
}
```

In addition, Terra used the summarizer in conjunction with the Translator API, to translate the original Portuguese article's title, subtitle, and body text to English. This translated version is processed by the Summarizer API to generate the summary, and then translated back into Portuguese. This ensures the user receives the summarized content in the application's language.

```
async function translateTextByBuiltInAI(text, sourceLanguage, targetLanguage) {
  if (!('translation' in self && 'createTranslator' in self.translation)) {
    return null
  }

  try {
    const translator = await Translator.create({
      sourceLanguage,
      targetLanguage,
    })
    return await translator.translate(text)
  } catch (error) {
    throw error
  }
}
const text = `Title: ${contentTitle};\n\n Sub-title: ${contentSubtitle};\n\n Article content: ${plainText}.`;

const canTranslate = await Translator.availability({
  sourceLanguage: 'pt',
  targetLanguage: 'en',
})

if (canTranslate !== 'available') {
  if (canTranslate === 'downloadable') {
    try {
      await Translator.create({
        sourceLanguage: 'pt',
        targetLanguage: 'en',
      })
      //EN: "Language download completed successfully."
      cms_alert(ALERT_TYPE_OK, "Download do idioma concluído com sucesso.");
    } catch (downloadError) {
      //EN: "Error downloading the language required for translation."
      cms_alert(ALERT_TYPE_ERROR, "Erro ao realizar download do idioma necessário para tradução.");
      return
    }
  } else {
    //EN: "Translation is not available or not ready."
    cms_alert(ALERT_TYPE_ERROR, "A tradução não está disponível ou não está pronta.");
    return
  }
}

const translatedText = await translateTextByBuiltInAI(text, 'pt', 'en') 
const summarizedText = await summarizerByBuiltInAI(translatedText) 
const translatedBackText = await translateTextByBuiltInAI(summarizedText, 'en', 'pt')
```

Terra's successful integration of built-in AI APIs demonstrates the significant potential of client-side AI to enhance content management workflows. With the Summarizer and Translator APIs, Terra has empowered its journalists, improved efficiency, and is well-positioned to deliver enhanced user experiences across platforms.

## Best practices

If the review input exceeds the token limit, follow these mitigations:

-   Use a smaller sample (such as the most recent 4 reviews) to the API. This helps generate faster results. Refer to our guidance on [scaling client-side summarization](/docs/ai/scale-summarization).
-   The `QuotaExceededError` provides more information about the requested tokens in the input. The `summarizer` object has an `inputQuota` property that indicates the API's token limit. This allows for real-time feedback and disabling functionality if the input exceeds the limit.

You may want to consider a hybrid approach, to ensure a seamless experience for all users. The first time a built-in AI API is called, the browser must download the model.

-   Miravia used a server-side model to provide an initial summary, while the model was downloading. Once the built-in model was ready, the site switched to performing inference client-side.

You should always strive to create a friendly and communicative interface:

-   [Implement a progress bar](https://web.dev/articles/building/a-loading-bar-component) for model downloads and mitigate response delays.
-   Consider transparency about the model download. Bright Sites notified users about the model download to allow for transparency and consent of resource usage. That way, users could accept or decline before proceeding.

## Conclusions and recommendations

Bright Sites and Terra's examples demonstrate the value of Summarizer API in enhancing content accessibility and reader engagement. By using this client-side API, these platforms improved reading experience and personalization, without additional business cost and with simplified data governance. Just like the Summarizer API, all of the [built-in AI APIs](/docs/ai/built-in-apis) enable practical client-side AI.

Wondering how the Summarizer API can help with other use cases? We've also shared how [the Summarizer API helps redBus and Miravia create helpful user review summaries](/blog/summarizer-redbus-miravia).

Are you building something new with these APIs? Share it with us at [@ChromiumDev on X](https://x.com/chromiumdev) or [Chromium for Developers on LinkedIn](https://www.linkedin.com/showcase/chrome-for-developers/).

## Resources

-   [Learn more about Summarizer API](/docs/ai/summarizer-api).
-   [Start using Built-in APIs on Chrome](/docs/ai/built-in-apis).
-   Read the [Prompt API case study on empowering bloggers](/blog/prompt-api-blog-cyberagent).
-   Read the [Translation and Language Detector case study](/blog/pb-jiohotstar-translation-ai).
-   Read how the [Summarizer API helps redBus and Miravia create helpful user review summaries](/blog/summarizer-redbus-miravia).

## Acknowledgements

Thank you to [Guilherme Moser](https://www.linkedin.com/in/guilhermems/) and [Fernando Fischer](https://www.linkedin.com/in/ti-fernandofischer/) from Terra, [Aline Souza](https://www.linkedin.com/in/alinenunessouza/) from CWI, [Brian Alford](https://www.linkedin.com/in/brian-alford/), [Keval Patel](https://www.linkedin.com/in/keval-r-patel/), [Jack Riley](https://www.linkedin.com/in/jackodriley/) and Brightsites' Engineering team, [Swetha Gopalakrishnan](https://www.linkedin.com/in/swetha-gopalakrishnan-5ba92936/), [Alexandra Klepper](/authors/alexandra-klepper), [Thomas Steiner](/authors/thomas-steiner) and [Kenji Baheux](https://jp.linkedin.com/in/baheux) for helping to write and review this document.