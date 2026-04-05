import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { castVote, VoteData } from "../services/api";
import { useTheme } from "../utils/theme";
import GADOIcon from "./GADOIcon";

interface Props {
  itemId: string;
  itemType: "place" | "event";
  initial?: VoteData;
  title?: string;
}

function animatePress(anim: Animated.Value) {
  Animated.sequence([
    Animated.spring(anim, { toValue: 1.08, useNativeDriver: true, speed: 20, bounciness: 6 }),
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
  ]).start();
}

export default function VoteButtons({
  itemId,
  itemType,
  initial,
  title = "Was this place worth it?",
}: Props) {
  const { colors, radii, typography } = useTheme();
  const [likes, setLikes] = useState(0);
  const [userVote, setUserVote] = useState(0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const likeScale = useRef(new Animated.Value(1)).current;
  const dislikeScale = useRef(new Animated.Value(1)).current;

  // Sync when initial data arrives (async fetch)
  useEffect(() => {
    if (initial) {
      setLikes(Number(initial.likes) || 0);
      setUserVote(Number(initial.userVote) || 0);
    }
  }, [initial]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 2200);
    return () => clearTimeout(t);
  }, [notice]);

  const styles = useMemo(() => StyleSheet.create({
    card: {
      width: "100%",
      backgroundColor: colors.surface,
      borderRadius: radii.lg,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.stroke,
      gap: 12,
    },
    title: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    row: { flexDirection: "row", gap: 12 },
    buttonWrap: { flex: 1 },
    voteButton: {
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.stroke,
      paddingHorizontal: 14,
      paddingVertical: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.chip,
    },
    likeActive: { borderColor: colors.success, backgroundColor: "#213629" },
    dislikeActive: { borderColor: colors.danger, backgroundColor: "#3A1D26" },
    buttonLabel: {
      color: colors.inkMuted,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: typography.body,
    },
    likeLabelActive: { color: colors.success },
    dislikeLabelActive: { color: colors.danger },
    summary: { color: colors.inkMuted, fontSize: 13, fontFamily: typography.body },
    notice: { color: colors.warning, fontSize: 12, fontWeight: "600", fontFamily: typography.body },
  }), [colors, radii, typography]);

  async function handleVote(vote: 1 | -1) {
    if (loading) return;
    setLoading(true);

    const prevLikes = likes;
    const prevUserVote = userVote;

    if (vote === 1) animatePress(likeScale);
    else animatePress(dislikeScale);

    // Optimistic update
    if (userVote === vote) {
      setUserVote(0);
      if (vote === 1) setLikes(v => Math.max(0, v - 1));
    } else {
      if (userVote === 1) setLikes(v => Math.max(0, v - 1));
      setUserVote(vote);
      if (vote === 1) setLikes(v => v + 1);
    }

    try {
      const result = await castVote(itemId, itemType, vote);
      setLikes(Number(result.likes ?? result.total_likes) || 0);
      setUserVote(Number(result.userVote) || 0);
    } catch {
      setLikes(prevLikes);
      setUserVote(prevUserVote);
      setNotice("Could not save vote, try again");
    } finally {
      setLoading(false);
    }
  }

  const summary = likes > 0
    ? `${likes} ${likes === 1 ? 'person' : 'people'} liked this place`
    : "Be the first to rate this place";

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        <Animated.View style={[styles.buttonWrap, { transform: [{ scale: likeScale }] }]}>
          <Pressable
            onPress={e => { e.stopPropagation?.(); void handleVote(1); }}
            style={({ pressed }) => [
              styles.voteButton,
              userVote === 1 && styles.likeActive,
              { opacity: pressed || loading ? 0.7 : 1 },
            ]}
            disabled={loading}
          >
            <GADOIcon name="like" category="feedback" size={18} color={userVote === 1 ? colors.success : colors.inkMuted} />
            <Text style={[styles.buttonLabel, userVote === 1 && styles.likeLabelActive]}>Liked it</Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.buttonWrap, { transform: [{ scale: dislikeScale }] }]}>
          <Pressable
            onPress={e => { e.stopPropagation?.(); void handleVote(-1); }}
            style={({ pressed }) => [
              styles.voteButton,
              userVote === -1 && styles.dislikeActive,
              { opacity: pressed || loading ? 0.7 : 1 },
            ]}
            disabled={loading}
          >
            <GADOIcon name="dislike" category="feedback" size={18} color={userVote === -1 ? colors.danger : colors.inkMuted} />
            <Text style={[styles.buttonLabel, userVote === -1 && styles.dislikeLabelActive]}>Nope</Text>
          </Pressable>
        </Animated.View>
      </View>

      <Text style={styles.summary}>{summary}</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}
