"use client";

import { useEffect } from 'react';
import { useLanguage } from '../../hooks/use-language';
import { getSiteTranslation } from '../../lib/site-translations';

const NO_TRANSLATE_SELECTOR = '[data-bmt-no-translate]';
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'aria-label', 'title'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);
const textStates = new WeakMap<Text, { original: string; applied: string }>();
const attributeStates = new WeakMap<Element, Map<string, { original: string; applied: string }>>();

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function isTranslationSkipped(element: Element | null) {
  return Boolean(element?.closest(NO_TRANSLATE_SELECTOR));
}

function translateTextNode(node: Text, language: ReturnType<typeof useLanguage>['language']) {
  const parent = node.parentElement;
  if (!parent || SKIP_TAGS.has(parent.tagName) || isTranslationSkipped(parent)) {
    return;
  }

  const current = normalizeText(node.nodeValue || '');
  if (!current) {
    return;
  }

  const previous = textStates.get(node);
  const original = previous && current === normalizeText(previous.applied)
    ? previous.original
    : current;
  const translated = getSiteTranslation(language, original);

  textStates.set(node, { original, applied: translated });

  if (translated !== current) {
    node.nodeValue = (node.nodeValue || '').replace(current, translated);
  }
}

function translateAttributes(element: Element, language: ReturnType<typeof useLanguage>['language']) {
  if (isTranslationSkipped(element)) {
    return;
  }

  TRANSLATABLE_ATTRIBUTES.forEach((attr) => {
    const value = element.getAttribute(attr);
    if (!value) {
      return;
    }

    const states = attributeStates.get(element) || new Map<string, { original: string; applied: string }>();
    const previous = states.get(attr);
    const original = previous && value === previous.applied ? previous.original : value;
    const translated = getSiteTranslation(language, original);

    states.set(attr, { original, applied: translated });
    attributeStates.set(element, states);
    if (translated !== value) {
      element.setAttribute(attr, translated);
    }
  });
}

function translateRoot(root: ParentNode, language: ReturnType<typeof useLanguage>['language']) {
  if (root instanceof Element && isTranslationSkipped(root)) {
    return;
  }

  if (root instanceof Element) {
    translateAttributes(root, language);
  }

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => translateTextNode(node, language));

  if ('querySelectorAll' in root) {
    root.querySelectorAll<HTMLElement>(TRANSLATABLE_ATTRIBUTES.map((attr) => `[${attr}]`).join(',')).forEach((element) => {
      translateAttributes(element, language);
    });
  }
}

export function SiteTranslator() {
  const { language } = useLanguage();

  useEffect(() => {
    document.documentElement.lang = language;

    const translatePage = () => translateRoot(document.body, language);
    translatePage();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target as Text, language);
          return;
        }

        if (mutation.type === 'attributes') {
          translateAttributes(mutation.target as Element, language);
          return;
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text, language);
          }

          if (node.nodeType === Node.ELEMENT_NODE) {
            translateRoot(node as Element, language);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
      subtree: true
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}
