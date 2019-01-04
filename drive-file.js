const template = document.createElement('template');
template.innerHTML = `<style>
:host {
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid #444444;
    display: block;
    height: 150px;
    margin: 5px;
    padding: 0;
    position: relative;
    width: 150px;
}

:host .name {
    background-color: rgba(255, 255, 255, 0.3);
    overflow: hidden;
    position: absolute;
    user-selectt: none;
    visibility: hidden;
    width: 100%;
}

:host(:hover) .name {
    visibility: visible;
}

:host .thumbnail {
    background-size: cover;
    background-position-x: center;
    background-position-y: center;
    height: 100%;
    width: 100%;
}
</style>`;

export default class DriveFile extends HTMLElement {
    constructor() {
        super();

        this.attachShadow({mode: 'open'});

        this.shadowRoot.appendChild(template.content.cloneNode(true));
    }

    get id() {
        return this.getAttribute('id');
    }

    set id(id) {
        this.setAttribute('id', id);
    }

    get name() {
        return this.getAttribute('name');
    }

    set name(name) {
        this.setAttribute('name', name);
    }

    connectedCallback() {
        const title = document.createElement('div');
        title.className = 'name';
        title.innerText = this.name;
        this.shadowRoot.appendChild(title);

        const thumbnail = document.createElement('div');
        thumbnail.className = 'thumbnail';
        thumbnail.style['background-image'] = `url(https://drive.google.com/thumbnail?authuser=0&sz=w320&id=${this.id})`;
        this.shadowRoot.appendChild(thumbnail);
    }
}

customElements.define('drive-file', DriveFile);