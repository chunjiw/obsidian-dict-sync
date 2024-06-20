import { App, Notice, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';

// Remember to rename these classes and interfaces!

interface CDSyncSettings {
	toLowerCase: boolean;
}

const DEFAULT_SETTINGS: CDSyncSettings = {
	toLowerCase: true
}

export default class CDSyncPlugin extends Plugin {
	settings: CDSyncSettings;

	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('book-copy', 'Sync Custom Dictionary', (evt: MouseEvent) => {
			this.syncCD();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync',
			name: 'Sync Custom Dictionary',
			callback: () => this.syncCD(),
		});
		
		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new CDSyncSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});
		
		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}
	
	async syncCD() {
		
		// load 'Custom Dictionary.md'
		const md = this.app.vault.getAbstractFileByPath('Custom Dictionary.md');
		if (!(md instanceof TFile)) {
			new Notice('Failed to read note "Custom Dictionary"');
			return;
		}
		const mdlist = await this.app.vault.read(md);
		const mdwords = mdlist.split('\n').map(word => word.trim());
		const set: Set<string> = new Set(mdwords);
		set.delete('');
		
		// load 'Custom Dictionary.txt' 
		const input = document.createElement('input');
		input.type = 'file';
		input.click();
		const fileListOrNull = await new Promise<FileList | null>((resolve) => {
			input.addEventListener('change', () => {
				resolve(input.files);
			});
		});
		if (!fileListOrNull) {
			return;
		}
		// Convert FileList to an array
		const files = Array.from(fileListOrNull);
		if (files.length < 1) {
			return;
		}
		const txt = files[0];
		// Read the content of the selected file as a string
		const txtlist = await this.readFileAsText(txt);
		txtlist.split('\n').map(word => {
			if (!word) return;
			if (word.startsWith('checksum')) return;
			set.add(word);
		});

		// Save merged dict to 'Custom Dictionary.md' 
		const merged = Array.from(set).join('\n');
		await this.app.vault.modify(md, merged);

		// Save merged to 'Custom Dictionary.txt'
		const blob = new Blob([merged], { type: 'text/plain' });
		const url = URL.createObjectURL(blob);
		const tmpDownloadEl = document.body.createEl('a', {
			href: url,
		});
		tmpDownloadEl.download = 'Custom Dictionary.txt';
		tmpDownloadEl.click();
		tmpDownloadEl.remove();
		URL.revokeObjectURL(url);
	}

	async readFileAsText(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (event) => {
				const result = event.target?.result as string;
				resolve(result);
			};
			reader.onerror = (event) => {
				reject(new Error(`Error reading file: ${event.target?.error?.message}`));
			};
			// Read the file as text
			reader.readAsText(file);
		});
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class CDSyncSettingTab extends PluginSettingTab {
	plugin: CDSyncPlugin;

	constructor(app: App, plugin: CDSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('To Lower Case')
			.setDesc('Convert first-letter-capped words to lower case')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.toLowerCase)
                .onChange(async (value) => {
                    this.plugin.settings.toLowerCase = value;
                    await this.plugin.saveSettings();
                }));
	}
}
