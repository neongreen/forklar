import * as deepl from "npm:deepl-node"
import * as openai from "npm:openai"
import outdent from "https://deno.land/x/outdent@v0.8.0/mod.ts"
import { marked } from "npm:marked"
import TerminalRenderer from "npm:marked-terminal"

// Load env vars
import "https://deno.land/std@0.179.0/dotenv/load.ts"

// Set up marked
marked.setOptions({
  renderer: new TerminalRenderer({
    reflowText: true,
    width: Deno.consoleSize().columns - 10,
  }),
})

const openaiApi = new openai.OpenAIApi(
  new openai.Configuration({
    apiKey: Deno.env.get("OPENAI_API_KEY")!,
  })
)

const deeplApi = new deepl.Translator(Deno.env.get("DEEPL_API_KEY")!)

async function handleSentence(prompt: string) {
  // Translate the prompt to Norwegian
  const translation: string = (
    await deeplApi.translateText(prompt, "en", "nb")
  ).text.trim()

  console.log(marked(`**Translation: \`${translation}\`**`))

  // Ask ChatGPT to explain word by word
  const openaiResponse = await openaiApi
    .createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: outdent`
            I have been studying Norwegian for several months, and I need your help.
            
            I want you to give detailed word by word explanations for Norwegian sentences. In your explanation, provide an English and a Russian translation for each word, and an example sentence for each word.

            The rules are:

              - Use the format specified below.
              - For simple words like "du", "en", "og", etc., you can just provide the word itself and its translations.
              - Do not provide any comments or notes on formatting.
              - Always surround Norwegian words and sentences with \`backticks\`.

            For instance, if your sentence is "Hvor ble du født?", your explanation should be the following list.

            1. \`Hvor\` (adv.) = "where", or "где" in Russian\\
               _... \`Hvor er toalettet?\` = "Where is the bathroom?"_

            2. \`ble\` (v.) = past tense form of the verb \`bli\`, which means "to become".\\
               _... \`Hun ble syk i går\` = "She became sick yesterday"_

            3. \`du\` (pron.) = "you", or "ты" in Russian.

            4. \`født\` (adj.) = "born", or "родился" in Russian.\\
               _... \`Jeg ble født i Oslo\` = "I was born in Oslo"_

            If a combination of words has a special meaning, you can provide an example sentence for that combination as well. For instance, if your sentence is "I det siste har jeg vært mye på tur", you can add the following note to your explanation:

            > Note: \`I det siste\` = "lately" or "recently"

            Now, your sentence in Norwegian to explain is: "${translation}"
          `,
        },
      ],
    })
    .catch((e) => {
      console.error(e)
      console.error(e.response.data)
    })

  if (openaiResponse) {
    const explanation: string =
      openaiResponse.data.choices[0].message?.content.trim()!
    console.log(marked(explanation))
  }
}

// On each line of stdin, call handleSentence
while (true) {
  const line = prompt(">")
  if (!line) continue
  console.log("")
  await handleSentence(line)
}
