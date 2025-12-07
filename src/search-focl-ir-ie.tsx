import { List, ActionPanel, Action, Color, getPreferenceValues } from "@raycast/api";
import { useState } from "react";
import * as cheerio from 'cheerio';

export default function Command() {
	const [word, setWord] = useState("");
	const [data, setData] = useState<(DictionaryEntry | null)[]>();
	const [isLoading, setIsLoading] = useState<boolean>(false);

	const preferences = getPreferenceValues<Preferences>();

	async function runSearch() {
		if (!word.trim()) return;

		setIsLoading(true);

		try {
			const response = await fetch(`https://focloir.ie/${preferences.language === "en" ? "en" : "ga"}/dictionary/ei/${word}`);
			const parsed = await parseFetchResponse(response);
			setData(parsed);
		} finally {
			setIsLoading(false);
		}
	}

	return (
		<List
			isLoading={isLoading}
			onSearchTextChange={setWord}
			searchBarPlaceholder={preferences.language === "en" ? "Enter word..." : "Clóscríobh focal..."}
			searchBarAccessory={
				<ActionPanel>
					<ActionPanel.Section>
						<Action
							title={preferences.language === "en" ? "Search" : "Cuardach"}
							onAction={runSearch}
							shortcut={{ modifiers: ["alt"], key: "enter" }}
						/>
					</ActionPanel.Section>
				</ActionPanel>
      		}
			isShowingDetail
		>
			{/* Handle no data, no word etc. */}
			{word === "" && !data &&
				<List.EmptyView title={preferences.language === "en" ? "Type a word and press enter to start" : "Clóscríobh focal agus brúigh an eochair iontrála a tosú"} />
			}
			{word !== "" && data && <List.EmptyView title={preferences.language === "en" ? "No results found" : "Níl fuarthas aon toradh"} />}
			<List.Section title={preferences.language === "en" ? "Results" : "Toradh"}>
				{/* @ts-expect-error: Since data is never null, entry cannot be null, so this error is ignored */}
				{data && word !== "" && data?.filter((entry) => entry && entry.number).map((entry) => <DictionaryEntryListItem key={entry?.number} entry={entry} language={preferences.language} />)}
			</List.Section>
		</List>
	);
}

function DictionaryEntryListItem({ entry, language }: { entry: DictionaryEntry, language: string }) {
	if (entry == null) return null;
	const markdown = [
		language === "en" ? "# Translations" : "# Aistriúcháin",
		...entry.words.map((word: string) => {
			return `**${word}**\n`;
		}),
		...entry.genders.map((gender: string) => {
			const gender_word = gender.split(" ");
			return `*${gender_word}*\n`;
		}),
		language === "en" ? "# Examples" : "# Samplaí",
		...entry.examples.map((example: { english: string, irish: string }) => {
			return `
### ${example.english}\n
${example.irish}
`
		})
	].join("\n");

	return (
		<List.Item
			title={entry.number}
			subtitle={entry.editorial_meaning}
			key={entry.number}
			accessories={[
				{
					tag: {
						value: entry.partOfSpeech,
						color: Color.Green
					}
				},
				// ...entry.domains.map((domain) => ({ tag: { value: domain } })),
			]}
			detail={
				<List.Item.Detail
					markdown={markdown}
				/>
			}
		/>
	);
}


/** Parse the response from the fetch query into something we can display */
async function parseFetchResponse(response: Response) {
	if (!response.ok) {
		throw new Error(response.statusText);
	}

	const html = await response.text();
  	const $ = cheerio.load(html);

	const definitions = $(".sense")
	.toArray()
	.filter((el) => {
		const $el = $(el);
		// Quick trick to remove phrases
		const hasEmptyLang = $el.find('[xml\\:lang=""]').length > 0;
		return !hasEmptyLang;
	});

	return definitions.map((definition) => {
		const $def = $(definition);

		const entry_number = $def.find(".span_sensenum").text().trim();
		const partOfSpeech = $def.find(".pos").first().text().trim() || "Phrase"; // Ideally phrases should be handled better, but for another time

		if (partOfSpeech === "Phrase") return null // Intentionally remove phrases, as they aren't properly handled yet

		const domains = $def
		.find(".lbl_purple_sc_i")
		.toArray()
		.map((el) => $(el).text().trim());

		const editorial_meaning = $def.find(".EDMEANING").text().trim();

		const words = $def.find(".cit_translation .quote").toArray().map((el) => $(el).text().trim());
		const genders = $def.find(".cit_translation .lbl_black_i").toArray().map((el) => $(el).text().trim());
		const examples = $def.find(".cit_example").toArray().map((el) => {
			const $el = $(el);
			const english = $el.find("> .quote").text().trim();
			const irish = $el.find(".cit_translation_noline").text().trim();

			return { english, irish };
		});

		return {
			number: entry_number,
			partOfSpeech: partOfSpeech,
			domains: domains,
			editorial_meaning: editorial_meaning,
			words: words,
			genders: genders,
			examples: examples,
		} as unknown as DictionaryEntry;
	});
}

interface DictionaryEntry {
	number: string;
	partOfSpeech: string;
	domains: Array<string>;
	editorial_meaning: string;
	words: string[];
	genders: string[];
	examples: {
		english: string;
		irish: string;
	}[];
}
