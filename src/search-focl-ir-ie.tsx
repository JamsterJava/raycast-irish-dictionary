import { List, ActionPanel, Action, Color } from "@raycast/api";
import { useState } from "react";
import * as cheerio from 'cheerio';

export default function Command() {
	const [word, setWord] = useState("");
	const [data, setData] = useState<DictionaryEntry[]>();
	const [isLoading, setIsLoading] = useState<boolean>(false);

	async function runSearch() {
		if (!word.trim()) return;

		setIsLoading(true);

		try {
			const response = await fetch(`https://focloir.ie/en/dictionary/ei/${word}`);
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
			searchBarPlaceholder="Enter word..."
			searchBarAccessory={
				<ActionPanel>
					<ActionPanel.Section>
						<Action
							title="Search"
							onAction={runSearch}
							shortcut={{ modifiers: ["alt"], key: "enter" }}
						/>
					</ActionPanel.Section>
				</ActionPanel>
      		}
			isShowingDetail
		>
			{/* Handle no data, no word etc. */}
			{word === "" && !data && <List.EmptyView icon={{ source: "https://placekitten.com/500/500" }} title="Type a word and press ALT+Enter to search" />}
			{word !== "" && data && <List.EmptyView icon={{ source: "https://placekitten.com/500/500" }} title="No results found" />}
			<List.Section title="Results" subtitle={""}>
				{ data && word !== "" && data?.map((entry) => <DictionaryEntryListItem key={entry.number} entry={entry} />)}
			</List.Section>
		</List>
	);
}

function DictionaryEntryListItem({ entry }: { entry: DictionaryEntry }) {
	const markdown = [
		"# Translations",
		...entry.words.map((word: string) => {
			const [translation_word, gender] = word.split(" ");
			return `#### ${translation_word} ${gender &&  ("(" + gender.trim() + ")")}`;
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
		const hasEmptyLang = $el.find('[xml\\:lang=""]').length > 0;
		return !hasEmptyLang;
	});

	return definitions.map((definition) => {
		const $def = $(definition);

		const entry_number = $def.find(".span_sensenum").text().trim();
		const partOfSpeech = $def.find(".pos").first().text().trim() || "Unknown";

		const domains = $def
		.find(".lbl_purple_sc_i")
		.toArray()
		.map((el) => $(el).text().trim());

		const editorial_meaning = $def.find(".EDMEANING").text().trim();

		const words = $def.find(".cit_translation").toArray().map((el) => $(el).text().trim());
		const examples = $def.find(".cit_example").toArray().map((el) => $(el).text().trim());

		return {
			number: entry_number,
			partOfSpeech: partOfSpeech,
			domains: domains,
			editorial_meaning: editorial_meaning,
			words: words,
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
	examples: string[];
}
