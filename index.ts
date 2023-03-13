import * as deepl from "npm:deepl-node"
import * as openai from "npm:openai"
import outdent from "https://deno.land/x/outdent@v0.8.0/mod.ts"
import { marked } from "npm:marked"
import TerminalRenderer from "npm:marked-terminal"
import Table from "npm:cli-table3"
import {
  yellow,
  bold,
  italic,
} from "https://deno.land/std@0.178.0/fmt/colors.ts"
import dirtyJson from "npm:dirty-json"

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

async function handleExplainWord(word: string) {
  const openaiResponse = await openaiApi
    .createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `I am learning Norwegian. Please concisely explain the meaning of the Norwegian word "${word}", like you're a dictionary.`,
        },
      ],
    })
    .catch((e) => {
      console.error(e)
      console.error(e.response.data)
    })
  if (openaiResponse) {
    console.log(marked(openaiResponse.data.choices[0].message?.content.trim()))
  }
}

async function handleCommand(prompt: string) {
  const openaiResponse = await openaiApi
    .createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })
    .catch((e) => {
      console.error(e)
      console.error(e.response.data)
    })
  if (openaiResponse) {
    console.log(openaiResponse.data.choices[0].message?.content.trim())
  }
}

async function handleSentence(prompt: string) {
  // Translate the prompt into Norwegian
  const translationResult = await deeplApi.translateText(prompt, null, "nb")
  let translation
  if (translationResult.detectedSourceLang === "en") {
    translation = translationResult.text.trim()
    console.log(marked(`**Translation: \`${translation}\`**`))
  } else {
    console.debug("Assuming the sentence is in Norwegian")
    translation = prompt
  }

  // Say it out loud by using the 'say' command on macOS
  void (async () => {
    await Deno.run({
      cmd: ["say", "-v", "Nora", "-r", "85", translation],
    }).status()
    await new Promise((resolve) => setTimeout(resolve, 500))
    await Deno.run({
      cmd: ["say", "-v", "Nora", "-r", "150", translation],
    }).status()
  })()

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
              - For simple words like "du", "en", "er", "og", you can just provide the word itself and its translations.

            For instance, if your sentence is "Hvor ble du født?", your explanation should be the following JSON object. Do not output any other text.

            {
              "explanation": [
                {"word": "Hvor", "english": "where", "russian": "где", "example": "Hvor er toalettet?", "translation": "Where is the bathroom?"},
                {"word": "ble", "english": "became (past tense of 'bli')", "russian": "был", "example": "Hun ble syk i går", "translation": "She became sick yesterday"},
                {"word": "du", "english": "you", "russian": "ты"},
                {"word": "født", "english": "born", "russian": "родился", "example": "Jeg ble født i Oslo", "translation": "I was born in Oslo"}
              ]
            }

            For very common compound words, you can provide a single row for a combination of words. For instance, if your sentence is "Jeg vil ha kjøtt i stedet for fisk.", your output should be as follows:

            {
              "explanation": [
                {"word": "Jeg", "english": "I", "russian": "я"},
                {"word": "vil", "english": "will", "russian": "хочу"},
                {"word": "ha", "english": "have", "russian": "иметь"},
                {"word": "kjøtt", "english": "meat", "russian": "мясо", "example": "Jeg liker kjøtt", "translation": "I like meat"},
                {"word": "i stedet for", "english": "instead of", "russian": "вместо", "example": "Jeg vil ha te i stedet for kaffe", "translation": "I want tea instead of coffee"},
                {"word": "fisk", "english": "fish", "russian": "рыба", "example": "Jeg liker fisk", "translation": "I like fish"}
              ]
            }

            If a combination of words has a special meaning, you can provide an example sentence for that combination as well. For instance, if your sentence is "I det siste har jeg vært mye på tur", you can add the following note to the JSON object:

            { 
              ...,
              "notes": [
                "'I det siste' = 'lately' or 'recently'"
              ]
            }

            If a word is a compound word, like "utgangspunktet", give translations for each part in notes. For example, if your sentence is "Bryllup er i utgangspunktet begravelser med kake.", add the following note to the JSON object:

            {
              ...,
              "notes": [
                ...,
                "'utgangspunktet' = 'utgangs' + 'punktet' = 'starting point'"
              ]
            }
            
            Add other useful notes about grammar, context, or culture, since I'm a beginner in Norwegian. But don't provide translations for words that are already translated in your explanation.

            ${
              translation !== prompt
                ? `The original sentence was: "${prompt}"`
                : ""
            }
            
            My translation to Norwegian is: "${translation}"
          `,
        },
      ],
    })
    .catch((e) => {
      console.error(e)
      console.error(e.response.data)
    })

  if (openaiResponse) {
    const result = dirtyJson.parse(
      openaiResponse.data.choices[0].message?.content!
    )
    const table = new Table({
      head: ["Word", "Translation", "Example"],
    })
    for (const row of result.explanation) {
      if ([",", ".", "!", "?"].includes(row.word.trim())) continue
      table.push([
        bold(yellow(row.word)),
        `${italic("English:")} ${row.english}` +
          "\n" +
          `${italic("Russian:")} ${row.russian}`,
        ...(row.example
          ? [yellow(row.example) + "\n" + italic(row.translation)]
          : []),
      ])
    }
    console.log(table.toString())

    if (result.notes) {
      console.log(marked(`**Notes:**`))
      for (const note of result.notes) {
        console.log(marked(`- ${note}`))
      }
    }
  }
}

while (true) {
  const line = prompt(">")
  if (!line) continue
  console.log("")
  if (line.startsWith("!")) {
    await handleCommand(line.slice(1))
  } else if (line.startsWith("?")) {
    await handleExplainWord(line.slice(1))
  } else {
    await handleSentence(line)
  }
  console.log("")
}
