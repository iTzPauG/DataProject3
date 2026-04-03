import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
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
  const [likes, setLikes] = useState(initial?.likes ?? 0);
  const [dislikes, setDislikes] = useState(initial?.dislikes ?? 0);
  const [userVote, setUserVote] = useState(initial?.userVote ?? 0);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const likeScale = useRef(new Animated.Value(1)).current;
  const dislikeScale = useRef(new Animated.Value(1)).current;

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
    row: {
      flexDirection: "row",
      gap: 12,
    },
    buttonWrap: {
      flex: 1,
    },
    voteButton: {
      minHeight: 92,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.stroke,
      paddingHorizontal: 14,
      paddingVertical: 14,
      justifyContent: "space-between",
      backgroundColor: colors.chip,
    },
    likeButton: {
      backgroundColor: "#19241F",
    },
    dislikeButton: {
      backgroundColor: "#241A20",
    },
    voteButtonActive: {
      borderColor: colors.success,
      backgroundColor: "#213629",
    },
    voteButtonDanger: {
      borderColor: colors.danger,
      backgroundColor: "#3A1D26",
    },
    buttonPressed: {
      opacity: 0.92,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    buttonHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    buttonLabel: {
      color: colors.inkMuted,
      fontSize: 14,
      fontWeight: "600",
      fontFamily: typography.body,
    },
    likeLabelActive: {
      color: colors.success,
    },
    dislikeLabelActive: {
      color: colors.danger,
    },
    buttonCount: {
      fontSize: 24,
      fontWeight: "700",
      fontFamily: typography.heading,
    },
    likeCount: {
      color: "#A2DDB4",
    },
    dislikeCount: {
      color: "#F1B1BF",
    },
    likeCountActive: {
      color: colors.success,
    },
    dislikeCountActive: {
      color: colors.danger,
    },
    summary: {
      color: colors.inkMuted,
      fontSize: 13,
      fontFamily: typography.body,
    },
    notice: {
      color: colors.warning,
      fontSize: 12,
      fontWeight: "600",
      fontFamily: typography.body,
    },
  }), [colors, radii, typography]);

  useEffect(() => {
    if (initial) {
      setLikes(initial.likes);
      setDislikes(initial.dislikes);
      setUserVote(initial.userVote);
    }
  }, [initial?.likes, initial?.dislikes, initial?.userVote]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2200);
    return () => clearTimeout(timer);
  }, [notice]);

  async function handleVote(vote: 1 | -1) {
    if (loading) return;
    setLoading(true);
    setNotice("");

    const prevLikes = likes;
    const prevDislikes = dislikes;
    const prevUserVote = userVote;

    if (vote === 1) animatePress(likeScale);
    else animatePress(dislikeScale);

    if (userVote === vote) {
      setUserVote(0);
      if (vote === 1) setLikes((value) => Math.max(0, value - 1));
      else setDislikes((value) => Math.max(0, value - 1));
    } else {
      if (userVote === 1) setLikes((value) => Math.max(0, value - 1));
      if (userVote === -1) setDislikes((value) => Math.max(0, value - 1));
      setUserVote(vote);
      if (vote === 1) setLikes((value) => value + 1);
      else setDislikes((value) => value + 1);
    }

    try {
      const result = await castVote(itemId, itemType, vote);
      setLikes(result.total_likes);
      setDislikes(result.total_dislikes);
      setUserVote(result.userVote);
    } catch {
      setLikes(prevLikes);
      setDislikes(prevDislikes);
      setUserVote(prevUserVote);
      setNotice("Could not save vote, try again");
    } finally {
      setLoading(false);
    }
  }

  const totalVotes = likes + dislikes;
  const summary = useMemo(() => {
    if (totalVotes <= 0) return "Be the first to rate this place";
    const helpful = Math.max(likes, dislikes);
    return `${helpful} people already weighed in`;
  }, [likes, dislikes, totalVotes]);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        <Animated.View style={[styles.buttonWrap, { transform: [{ scale: likeScale }] }]}>
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              void handleVote(1);
            }}
            style={({ pressed }) => [
              styles.voteButton,
              styles.likeButton,
              userVote === 1 && styles.voteButtonActive,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            disabled={loading}
          >
            <View style={styles.buttonHeader}>
              <GADOIcon name="like" category="feedback" size={18} color={userVote === 1 ? colors.success : colors.inkMuted} />
              <Text style={[styles.buttonLabel, userVote === 1 && styles.likeLabelActive]}>Liked it</Text>
            </View>
            <Text style={[styles.buttonCount, styles.likeCount, userVote === 1 && styles.likeCountActive]}>
              {likes}
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View style={[styles.buttonWrap, { transform: [{ scale: dislikeScale }] }]}>
          <Pressable
            onPress={(event) => {
              event.stopPropagation?.();
              void handleVote(-1);
            }}
            style={({ pressed }) => [
              styles.voteButton,
              styles.dislikeButton,
              userVote === -1 && styles.voteButtonDanger,
              pressed && styles.buttonPressed,
              loading && styles.buttonDisabled,
            ]}
            disabled={loading}
          >
            <View style={styles.buttonHeader}>
              <GADOIcon name="dislike" category="feedback" size={18} color={userVote === -1 ? colors.danger : colors.inkMuted} />
              <Text style={[styles.buttonLabel, userVote === -1 && styles.dislikeLabelActive]}>Nope</Text>
            </View>
            <Text style={[styles.buttonCount, styles.dislikeCount, userVote === -1 && styles.dislikeCountActive]}>
              {dislikes}
            </Text>
          </Pressable>
        </Animated.View>
      </View>

      <Text style={styles.summary}>{summary}</Text>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}
