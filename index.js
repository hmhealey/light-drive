import {ClientId} from './credentials.js';
import {Drive} from './drive.js';
import './drive-file.js';

const app = {
    authToken: '',
    selection: null,
};
let drive;

function makeOAuthUrl() {
    return 'https://accounts.google.com/o/oauth2/v2/auth?' +
        'scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive&' +
        'redirect_uri=http%3A%2F%2Flocalhost:8000&' +
        'response_type=token&' +
        'client_id=' + ClientId;
}

function getToken() {
    return getTokenFromURL() || getTokenFromStorage();
}

function getTokenFromStorage() {
    return localStorage.getItem('token');
}

function getTokenFromURL(hash = window.location.hash) {
    const params = hash.substring(1).split('&');

    for (const param of params) {
        const [name, value] = param.split('=');

        if (name === 'access_token') {
            return value;
        }
    }

    return '';
}

function storeToken(token) {
    localStorage.setItem('token', token);
}

async function checkToken(token) {
    if (!token) {
        return false;
    }

    const resp = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', getAuthHeaders(token));
    const data = await resp.json();

    if (data.error) {
        return false;
    }

    storeToken(token);

    return true;
}

function getAuthHeaders(token = app.authToken) {
    const headers = new Headers();
    headers.append('Authorization', 'Bearer ' + token);
    return {headers};
}

async function showFolder(folderId, path) {
    const [
        folder,
        files,
    ] = await Promise.all([
        drive.getFile(folderId, [['fields', 'id,parents']]),
        drive.listFiles([
            ['q', `'${folderId}' in parents and trashed = false`],
            ['orderBy', 'folder, name_natural'],
        ]),
    ]);

    app.folder = folder;
    app.path = path;
    app.files = files.files;
    app.nextPageToken = files.nextPageToken;

    showFiles(folder, files);
}

async function showNextPage(folderId, pageToken) {
    const files = await drive.listFiles([
        ['q', `'${folderId}' in parents and trashed = false`],
        ['orderBy', 'folder, name_natural'],
        ['pageToken', pageToken],
    ]);

    app.files.push(...files.files);
    app.nextPageToken = files.nextPageToken;

    showFiles(app.folder, files, pageToken);
}

function showFiles(folder, files, pageToken) {
    const container = document.getElementById('files');

    if (!pageToken) {
        container.innerHTML = '';

        if (folder.parents && folder.parents[0]) {
            container.appendChild(showFile({
                id: folder.parents[0],
                name: 'Parent',
            }));
        }
    }

    for (const file of files.files) {
        container.appendChild(showFile(file));
    }

    if (files.nextPageToken) {
        container.appendChild(showFile({
            id: folder.id,
            name: 'Next',
            folderId: folder.id,
            pageToken: files.nextPageToken,
        }));
    }
}

function showFile(file, parentId) {
    let div = document.createElement('div');
    div.className = 'item';

    const name = document.createElement('div');
    name.className = 'name';
    name.innerText = file.name;
    div.appendChild(name);

    if (file.mimeType === 'application/vnd.google-apps.folder' || file.name === 'Parent') {
        const icon = document.createElement('i');

        if (file.name === 'Parent') {
            icon.className = 'fas fa-level-up-alt fa-5x';
        } else {
            icon.className = 'fas fa-folder fa-5x';
        }

        div.appendChild(icon);

        div.className += ' folder';
        // div.oncclick = () => setSelection(file);
        div.ondblclick = () => {
            const nextPath = [...app.path];
            if (file.name === 'Parent') {
                nextPath.pop();
            } else {
                nextPath.push(file.name);
            }

            showFolder(file.id, nextPath);

            window.history.pushState(nextPath, '', window.location.pathname + (nextPath.length > 0 ? `?path=${nextPath.join('/')}` : ''));

            window.scrollTo(0, 0);
        };
    } else if (file.name === 'Next') {
        const icon = document.createElement('i');

        if (file.name === 'Next') {
            icon.className = 'fas fa-arrow-right fa-5x';
        }

        div.appendChild(icon);

        div.className += ' folder';
        div.ondblclick = () => {
            showNextPage(file.folderId, file.pageToken);

            div.parentElement.removeChild(div);
        };
    } else {
        div = document.createElement('drive-file');
        div.id = file.id;
        div.name = file.name;
        div.onclick = () => setSelection(file);
        div.ondblclick = () => {
            const w = window.open();
            w.opener = null;
            w.location = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&access_token=${app.authToken}`;
        }
    }

    return div;
}

function setSelection(file) {
    // TODO
    return;

    if (app.selection && app.selection.id === file.id) {
        app.selection = null;

        hideDetails();
    } else {
        app.selection = file;

        showDetails(file);
    }
}

function showDetails(file) {
    const details = document.getElementById('details');

    details.style.display = 'flex';
}

function hideDetails() {
    const details = document.getElementById('details');

    details.style.display = 'none';
}

function getPathFromUrl() {
    let rawPath = '';

    const params = window.location.search.replace(/^\?/, '').split('&');
    for (const param of params) {
        const [key, value] = param.split('=');

        if (key === 'path') {
            rawPath = value;
            break;
        }
    }

    return rawPath.replace(/^\/|\/$/g, '').split('/').filter(String);
}

window.onload = async function() {
    app.authToken = getToken();

    const loggedIn = await checkToken(app.authToken);
    if (!loggedIn) {
        document.body.innerHTML = `<a href="${makeOAuthUrl()}">Login</a>`;
        return;
    }

    drive = new Drive(app.authToken);
    await drive.buildDirectories();

    const path = getPathFromUrl();
    const folderId = drive.getFolderIdForPath(path);
    showFolder(folderId, path);

    window.history.replaceState(path, '', window.location.pathname + (path.length > 0 ? `?path=${path.join('/')}` : ''));
};

window.onpopstate = function(event) {
    const path = event.state;
    const folderId = drive.getFolderIdForPath(path);
    showFolder(folderId, path);
}