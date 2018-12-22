export class Drive {
    constructor(token, refreshToken) {
        this.token = token;
        this.refreshToken = refreshToken;

        this.rootId = '';
        this.directories = {};
        this.filesById = {};
    }

    async buildDirectories() {
        const root = await this.getFile('root');
        this.rootId = root.id;

        let page = await this.listFiles([
            ['q', `mimeType = 'application/vnd.google-apps.folder'`],
            ['fields', 'files,nextPageToken'],
        ]);

        let folders = page.files;

        while (page.nextPageToken) {
            page = await this.listFiles([
                ['q', `mimeType = 'application/vnd.google-apps.folder'`],
                ['fields', 'files,nextPageToken'],
                ['pageToken', page.nextPageToken],
            ]);

            folders = [...folders, ...page.files];
        }

        for (const folder of folders) {
            this.filesById[folder.id] = folder;
        }

        const doBuildDirectories = (name, id) => ({
            name,
            id,
            children: folders.
                filter((folder) => folder.parents && folder.parents.indexOf(id) !== -1).
                map((folder) => doBuildDirectories(folder.name, folder.id)).
                sort((a, b) => a.name.localeCompare(b.name)),
        });

        this.directories = doBuildDirectories('root', root.id);
    }

    getFolderIdForPath(path) {
        let current = this.directories;

        for (const part of path) {
            const next = current.children.find(({name}) => name === part);

            if (!next) {
                console.error(`Folder ${part} not found`);
                return '';
            }

            current = next;
        }

        return current.id;
    }

    // API calls

    getFile(fileId, params) {
        return this.fetch(`https://www.googleapis.com/drive/v3/files/${fileId}${this.encodeParams(params)}`);
    }

    listFiles(params) {
        return this.fetch(`https://www.googleapis.com/drive/v3/files${this.encodeParams(params)}`);
    }

    encodeParams(params) {
        if (!params || params.length === 0) {
            return '';
        }

        return '?' + params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
    }

    async fetch(url, method = 'GET') {
        const headers = new Headers();
        if (this.token) {
            headers.append('Authorization', `Bearer ${this.token}`);
        }

        let resp = await fetch(url, {headers, method});

        if (resp.statusCode === 401) {
            await this.refreshToken();

            resp = await fetch(url, {headers, method});
        }

        return await resp.json();
    }
}