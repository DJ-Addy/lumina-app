import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { MemoryBookData } from "../providers/pdf.js";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#0D0B2A",
    padding: 40,
    fontFamily: "Helvetica",
  },
  coverPage: {
    backgroundColor: "#0D0B2A",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 60,
  },
  title: {
    fontSize: 32,
    color: "#E8A0E0",
    textAlign: "center",
    marginBottom: 16,
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 14,
    color: "#A89BC0",
    textAlign: "center",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 11,
    color: "#6B5A8A",
    textAlign: "center",
    marginTop: 24,
    fontStyle: "italic",
  },
  entryPage: {
    backgroundColor: "#0D0B2A",
    padding: 48,
  },
  weekLabel: {
    fontSize: 10,
    color: "#A89BC0",
    textTransform: "uppercase",
    letterSpacing: 2,
    marginBottom: 8,
  },
  entryText: {
    fontSize: 12,
    color: "#E0D6F0",
    lineHeight: 1.8,
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 9,
    color: "#6B5A8A",
    marginTop: 4,
  },
  moodRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 8,
  },
  moodTag: {
    fontSize: 8,
    color: "#A89BC0",
    borderWidth: 1,
    borderColor: "#6B5A8A",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#2A2048",
    marginVertical: 20,
  },
  sectionHeader: {
    fontSize: 16,
    color: "#E8A0E0",
    letterSpacing: 2,
    marginBottom: 20,
    textTransform: "uppercase",
  },
  star: {
    fontSize: 20,
    color: "#E8A0E0",
    textAlign: "center",
    marginVertical: 16,
  },
});

export function MemoryBookDocument({
  babyName,
  monthCheckpoint,
  entries,
  letters,
}: MemoryBookData) {
  const checkpointLabels: Record<number, string> = {
    3: "Three Months",
    6: "Six Months",
    12: "One Year",
  };
  const checkpointLabel = checkpointLabels[monthCheckpoint] ?? `Month ${monthCheckpoint}`;

  return (
    <Document
      title={`Lumina Memory Book — ${babyName}`}
      author="Lumina"
      creator="Lumina — The Fourth Trimester Journal"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.star}>✦</Text>
          <Text style={styles.title}>LUMINA</Text>
          <Text style={styles.subtitle}>The Fourth Trimester Journal</Text>
          <View style={styles.divider} />
          <Text style={styles.subtitle}>{babyName}</Text>
          <Text style={styles.subtitle}>First {checkpointLabel}</Text>
          <Text style={styles.tagline}>Cosmic. Emotional. Yours.</Text>
        </View>
      </Page>

      {letters.length > 0 && (
        <Page size="A4" style={styles.entryPage}>
          <Text style={styles.sectionHeader}>Letters to {babyName}</Text>
          {letters.map((letter, i) => (
            <View key={i}>
              <Text style={styles.entryText}>{letter.content}</Text>
              <Text style={styles.dateLabel}>{new Date(letter.createdAt).toLocaleDateString()}</Text>
              {i < letters.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </Page>
      )}

      {entries.length > 0 && (
        <Page size="A4" style={styles.entryPage}>
          <Text style={styles.sectionHeader}>Journal Entries</Text>
          {entries.slice(0, 15).map((entry, i) => (
            <View key={i}>
              <Text style={styles.weekLabel}>Week {entry.weekNumber}</Text>
              <Text style={styles.entryText}>{entry.content}</Text>
              <Text style={styles.dateLabel}>{new Date(entry.createdAt).toLocaleDateString()}</Text>
              {entry.moodTags.length > 0 && (
                <View style={styles.moodRow}>
                  {entry.moodTags.map((tag) => (
                    <Text key={tag} style={styles.moodTag}>
                      {tag}
                    </Text>
                  ))}
                </View>
              )}
              {i < entries.slice(0, 15).length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </Page>
      )}

      <Page size="A4" style={styles.page}>
        <View style={styles.coverPage}>
          <Text style={styles.star}>✦</Text>
          <Text style={styles.tagline}>Your mom wrote this when you were little.</Text>
          <Text style={styles.tagline}>She was tired and a little scared</Text>
          <Text style={styles.tagline}>and completely in love with you.</Text>
          <Text style={[styles.star, { marginTop: 40 }]}>✦</Text>
        </View>
      </Page>
    </Document>
  );
}
