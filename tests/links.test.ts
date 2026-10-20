import { test } from "node:test";
import assert from "node:assert/strict";
import {
  detectSource,
  extractFirstUrl,
  isAllowedHost,
  isFetchableUrl,
  parsePlaceName,
  safeNext,
} from "../src/lib/links.ts";

test("detectSource recognises the main providers", () => {
  assert.equal(detectSource("https://maps.app.goo.gl/abc123"), "google_maps");
  assert.equal(
    detectSource("https://www.google.com/maps/place/Zeughauskeller/@47.37,8.54,17z"),
    "google_maps",
  );
  assert.equal(detectSource("https://maps.apple.com/?q=Cafe&ll=47.3,8.5"), "apple_maps");
  assert.equal(
    detectSource("https://www.tripadvisor.com/Restaurant_Review-g188113-d1-Reviews-Foo-Zurich.html"),
    "tripadvisor",
  );
  assert.equal(detectSource("https://www.booking.com/hotel/ch/foo.html"), "booking");
  assert.equal(detectSource("https://example.com/maps/place/x"), "other");
  assert.equal(detectSource("not a url"), "other");
});

test("host allowlist rejects look-alike and unknown hosts", () => {
  assert.equal(isAllowedHost("www.google.com"), true);
  assert.equal(isAllowedHost("consent.google.com"), true);
  assert.equal(isAllowedHost("maps.apple.com"), true);
  assert.equal(isAllowedHost("google.evil.com"), false);
  assert.equal(isAllowedHost("evilgoogle.com"), false);
  assert.equal(isAllowedHost("google.com.evil.com"), false);
  assert.equal(isAllowedHost("localhost"), false);
  assert.equal(isAllowedHost("169.254.169.254"), false);
});

test("isFetchableUrl enforces https, no credentials, standard port", () => {
  assert.equal(isFetchableUrl("https://maps.app.goo.gl/abc"), true);
  assert.equal(isFetchableUrl("http://maps.app.goo.gl/abc"), false);
  assert.equal(isFetchableUrl("https://user:pw@www.google.com/maps"), false);
  assert.equal(isFetchableUrl("https://www.google.com:8443/maps"), false);
  assert.equal(isFetchableUrl("https://169.254.169.254/latest/meta-data"), false);
});

test("extractFirstUrl finds links inside shared text", () => {
  assert.equal(
    extractFirstUrl("Zeughauskeller\nhttps://maps.app.goo.gl/abc123"),
    "https://maps.app.goo.gl/abc123",
  );
  assert.equal(extractFirstUrl("see (https://example.com/a)."), "https://example.com/a");
  assert.equal(extractFirstUrl("no link here"), null);
});

test("parsePlaceName reads names from URLs", () => {
  assert.equal(
    parsePlaceName("https://www.google.com/maps/place/Caf%C3%A9+Sprüngli/@47.37,8.54,17z"),
    "Café Sprüngli",
  );
  assert.equal(parsePlaceName("https://maps.apple.com/?q=Blue+Bottle&ll=1,2"), "Blue Bottle");
  assert.equal(
    parsePlaceName(
      "https://www.tripadvisor.com/Restaurant_Review-g188113-d1234-Reviews-Zeughauskeller-Zurich.html",
    ),
    "Zeughauskeller",
  );
  assert.equal(parsePlaceName("https://maps.app.goo.gl/abc123"), null);
  assert.equal(parsePlaceName("https://www.google.com/maps?q=47.37,8.54"), null);
});

test("safeNext blocks open redirects", () => {
  assert.equal(safeNext("/join/abc"), "/join/abc");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext(null), "/");
});
