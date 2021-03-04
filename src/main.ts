import { LitElement, html, css, property } from "lit-element";
import { hass } from "card-tools/src/hass";
import pjson from "../package.json";
import { selectTree } from "card-tools/src/helpers";

interface LovelaceElement extends HTMLElement {
  hass?: any;
}

interface FoldEntityRowConfig {
  type: string;
  open: boolean;
  entity?: any;
  head?: any;
  items?: any[];
  entities?: any[];
  group_config?: any;
  padding?: number;
}

const DEFAULT_CONFIG = {
  open: false,
  padding: 24,
  group_config: {},
};

function ensureObject(config: any) {
  if (config === undefined) return undefined;
  return typeof config === "string" ? { entity: config } : config;
}

class FoldEntityRow extends LitElement {
  @property() open: boolean = false;
  @property() head?: LovelaceElement;
  @property() rows?: LovelaceElement[];
  _config: FoldEntityRowConfig;
  _hass: any;

  setConfig(config: FoldEntityRowConfig) {
    this._config = config = Object.assign({}, DEFAULT_CONFIG, config);
    this.open = this.open || this._config.open;

    let head = ensureObject(config.entity || config.head);
    if (!head) {
      throw new Error("No fold head specified");
    }

    // Items are taken from the first available of the following
    // - config entities: (this allows auto-population of the list)
    // - config items: (for backwards compatibility - not recommended)
    // - The group specified as head
    let items = config.entities || config.items;
    if (head.entity && items === undefined) {
      items = hass().states[head.entity]?.attributes?.entity_id;
    }
    if (items === undefined) {
      throw new Error("No entities specified.");
    }
    if (!items || !Array.isArray(items)) {
      throw new Error("Entities must be a list.");
    }

    (async () => {
      this.head = await this._createRow(head, true);
      this.rows = await Promise.all(
        items.map(async (i) => this._createRow(ensureObject(i)))
      );
    })();
  }

  async _createRow(config: any, head = false) {
    const helpers = await (window as any).loadCardHelpers();
    if (!head) {
      config = Object.assign({}, this._config.group_config, config);
    }

    const el = helpers.createRowElement(config);
    this.applyStyle(el, config, head);
    if (this._hass) {
      el.hass = this._hass;
    }

    return el;
  }

  async applyStyle(root: HTMLElement, config: any, head = false) {
    if (head) {
      // Special styling to stretch
      if (root.localName === "hui-section-row") {
        root.style.minHeight = "53px";
        const el = await selectTree(root, "$.divider");
        el.style.marginRight = "-56px";
      }
    }
    await customElements.whenDefined("card-mod");
    customElements
      .get("card-mod")
      .applyToElement(
        root,
        "row",
        config.card_mod ? config.card_mod.style : config.style,
        { config }
      );
  }

  toggle(ev: Event) {
    if (ev) ev.stopPropagation();
    this.open = !this.open;
  }

  set hass(hass: any) {
    this._hass = hass;
    this.rows?.forEach((e) => (e.hass = hass));
    if (this.head) this.head.hass = hass;
  }

  customEvent(ev: CustomEvent) {
    const detail: any = ev.detail;
    if (detail.fold_row) {
      this.toggle(ev);
    }
  }

  render() {
    return html`
      <div id="head" @ll-custom=${this.customEvent} ?open=${this.open}>
        ${this.head}
        <ha-icon
          @click=${this.toggle}
          icon=${this.open ? "mdi:chevron-up" : "mdi:chevron-down"}
        ></ha-icon>
      </div>

      <div
        id="items"
        ?open=${this.open}
        style=${`padding-left: ${this._config.padding}px`}
      >
        ${this.rows}
      </div>
    `;
  }

  static get styles() {
    return css`
      #head {
        display: flex;
        align-items: center;
        --toggle-icon-width: 24px;
      }
      #head :not(ha-icon) {
        flex-grow: 1;
        max-width: calc(100% - var(--toggle-icon-width));
      }
      #head ha-icon {
        width: var(--toggle-icon-width);
        cursor: pointer;
      }

      #items {
        padding: 0;
        margin: 0;
        overflow: hidden;
        max-height: 0;
      }
      #items[open] {
        overflow: visible;
        max-height: none;
      }
    `;
  }
}

if (!customElements.get("fold-entity-row")) {
  customElements.define("fold-entity-row", FoldEntityRow);
  console.info(
    `%cFOLD-ENTITY-ROW ${pjson.version} IS INSTALLED`,
    "color: green; font-weight: bold",
    ""
  );
}
