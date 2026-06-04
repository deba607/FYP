"use client";

import { useEffect } from 'react';
import { useLanguage } from '../../hooks/use-language';
import { getSiteTranslation } from '../../lib/site-translations';

const ORIGINAL_TEXT = 'data-bmt-original-text';
const ORIGINAL_ATTR_PREFIX = 'data-bmt-original-';
const NO_TRANSLATE_SELECTOR = '[data-bmt-no-translate]';
const TRANSLATABLE_ATTRIBUTES = ['placeholder', 'aria-label', 'title'] as const;
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'TEXTAREA']);

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

  const original = parent.getAttribute(ORIGINAL_TEXT) || current;
  const translated = getSiteTranslation(language, original);

  parent.setAttribute(ORIGINAL_TEXT, original);

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

    const dataAttr = `${ORIGINAL_ATTR_PREFIX}${attr}`;
    const original = element.getAttribute(dataAttr) || value;
    const translated = getSiteTranslation(language, original);

    element.setAttribute(dataAttr, original);
    element.setAttribute(attr, translated);
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
      subtree: true
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}
