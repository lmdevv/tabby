# Debug Gemini Nano

## Debug Gemini Nano

![Thomas Steiner](https://web.dev/images/authors/thomassteiner.jpg)

Published: February 28, 2025

In Chrome, [built-in AI](/docs/ai/built-in) relies on Gemini Nano to perform inference for all of the APIs. Sometimes, Gemini Nano may return an error message or otherwise fail to return the result you expect. You can review debug information for all [built-in AI APIs](/docs/ai/built-in-apis) that use Gemini Nano. This includes the Prompt API, the Summarizer API, the Writer API, and the Rewriter API.

1.  Open Chrome and go to `chrome://on-device-internals`.
2.  Select **Event Logs**.
3.  (Optional) Click **Dump** to download a JSON file with all of the event information.

You can [file a bug](https://new.crbug.com/) so we can address this error in our implementation.

## Debug the Prompt API

For example, in the following session the user requested rhyming words from the Prompt API.

```
const session = await LanguageModel.create({
  systemPrompt: "You are an API endpoint that returns rhymes as JSON for an input word."
});

await session.prompt([
  { role: "user", content: "house" },  
  { role: "assistant", content: "{\"input\": \"house\", \"output\": \"mouse\"}" },
  { role: "user", content: "file"},  
]);
```

The model's response was as follows, formatted for legibility:

````
```json
[]
```

**Reasoning:**

The input you provided (empty arrays) is an empty list or array in JSON format.
When you try to find rhymes for an empty list, you're essentially looking for
words that rhyme with nothing.


Therefore, there are no rhymes to return. The JSON response will be an empty
array `[]`."
````

Why did the model not return a JSON message with a rhyming word, ideally, `{"input": "file", "output": "pile"}`? Although [structured output](https://github.com/webmachinelearning/prompt-api?tab=readme-ov-file#structured-output-or-json-output) isn't implemented yet at the time of this writing, the response should at least _somehow_ perform the rhyming task.

To debug this error, visit `chrome://on-device-internals/` and go to the **Event Logs** tab. The log reveals that the problem was in the model's interpretation of the prompt. Instead of JSON, the model understood the input as a string: `[object Object],[object Object],[object Object]`.

Here's the complete debug message, formatted for legibility:

```
Executing model with input context of 0 tokens:
<system>You are an API endpoint that returns rhymes as JSON for an input word.<end>
with string: <user>[object Object],[object Object],[object Object]<end> <model>
```

![The Event Logs tab of the special page chrome://on-device-internals with debugging information.](/static/docs/ai/debug-gemini-nano/on-device-internals.png)

We added this information to a bug for the model issue, [Prompt API seems to run `toString()` on JSON input](https://issues.chromium.org/issues/392661409), which helped the engineering team identify the issue.

Share your debugging feedback by filing a [bug report](https://issues.chromium.org/issues/new?component=1583300&priority=P2&type=bug&template=2096235&noWizard=true&pli=1).

Except as otherwise noted, the content of this page is licensed under the [Creative Commons Attribution 4.0 License](https://creativecommons.org/licenses/by/4.0/), and code samples are licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0). For details, see the [Google Developers Site Policies](https://developers.google.com/site-policies). Java is a registered trademark of Oracle and/or its affiliates.

Last updated 2025-02-28 UTC.