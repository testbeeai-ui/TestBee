"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StarRating, StarRatingBadge } from "@/components/StarRating";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Star, Video, Volume2, Pencil, Send, MessageSquareText, CheckCircle2 } from "lucide-react";
import { UserHoverCard } from "@/components/UserHoverCard";
import { motion, AnimatePresence, Variants } from "framer-motion";

interface Review {
    id: string;
    classroom_id: string;
    user_id: string;
    rating: number;
    comment: string | null;
    video_rating: number | null;
    voice_rating: number | null;
    is_explorer: boolean;
    created_at: string;
    updated_at: string;
    reviewer_name?: string;
}

interface RatingSummary {
    review_count: number;
    avg_rating: number;
    avg_video_rating: number | null;
    avg_voice_rating: number | null;
}

interface ClassroomReviewsProps {
    classroomId: string;
    isOwner: boolean;
    compact?: boolean;
    isExplorer?: boolean;
    onReviewSubmitted?: () => void;
}

const listVariants: Variants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants: Variants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export default function ClassroomReviews({
    classroomId,
    isOwner,
    compact = false,
    isExplorer = false,
    onReviewSubmitted,
}: ClassroomReviewsProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [reviews, setReviews] = useState<Review[]>([]);
    const [summary, setSummary] = useState<RatingSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [myReview, setMyReview] = useState<Review | null>(null);
    const [editing, setEditing] = useState(false);

    // Form state
    const [rating, setRating] = useState(0);
    const [comment, setComment] = useState("");
    const [videoRating, setVideoRating] = useState(0);
    const [voiceRating, setVoiceRating] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [showOptional, setShowOptional] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const fetchReviews = useCallback(async () => {
        if (!classroomId) return;
        setLoading(true);

        const { data: revData } = await (supabase as any)
            .from("classroom_reviews")
            .select("*")
            .eq("classroom_id", classroomId)
            .order("created_at", { ascending: false });

        const rawReviews = (revData as unknown as Review[]) || [];

        if (rawReviews.length > 0) {
            const userIds = [...new Set(rawReviews.map((r) => r.user_id))];
            const { data: profiles } = await supabase
                .from("profiles")
                .select("id, name")
                .in("id", userIds);
            const nameMap = new Map(
                (profiles || []).map((p: { id: string; name: string | null }) => [p.id, p.name])
            );
            rawReviews.forEach((r) => {
                r.reviewer_name = nameMap.get(r.user_id) ?? "Student";
            });
        }

        setReviews(rawReviews);

        if (user) {
            const mine = rawReviews.find((r) => r.user_id === user.id);
            if (mine) {
                setMyReview(mine);
                setRating(mine.rating);
                setComment(mine.comment || "");
                setVideoRating(mine.video_rating || 0);
                setVoiceRating(mine.voice_rating || 0);
                if (mine.video_rating || mine.voice_rating) setShowOptional(true);
            }
        }

        if (rawReviews.length > 0) {
            const avgRating = rawReviews.reduce((s, r) => s + r.rating, 0) / rawReviews.length;
            const videoReviews = rawReviews.filter((r) => r.video_rating != null);
            const voiceReviews = rawReviews.filter((r) => r.voice_rating != null);
            setSummary({
                review_count: rawReviews.length,
                avg_rating: Math.round(avgRating * 10) / 10,
                avg_video_rating:
                    videoReviews.length > 0
                        ? Math.round((videoReviews.reduce((s, r) => s + (r.video_rating ?? 0), 0) / videoReviews.length) * 10) / 10
                        : null,
                avg_voice_rating:
                    voiceReviews.length > 0
                        ? Math.round((voiceReviews.reduce((s, r) => s + (r.voice_rating ?? 0), 0) / voiceReviews.length) * 10) / 10
                        : null,
            });
        } else {
            setSummary(null);
        }

        setLoading(false);
    }, [classroomId, user]);

    useEffect(() => {
        queueMicrotask(() => {
            void fetchReviews();
        });
    }, [fetchReviews]);

    const handleSubmit = async () => {
        if (!user || rating === 0) {
            toast({ title: "Please select a star rating", variant: "destructive" });
            return;
        }
        setSubmitting(true);

        const payload = {
            classroom_id: classroomId,
            user_id: user.id,
            rating,
            comment: comment.trim() || null,
            video_rating: videoRating > 0 ? videoRating : null,
            voice_rating: voiceRating > 0 ? voiceRating : null,
            is_explorer: isExplorer,
            updated_at: new Date().toISOString(),
        };

        if (myReview) {
            const { error } = await (supabase as any).from("classroom_reviews").update(payload).eq("id", myReview.id);
            if (error) {
                toast({ title: "Error updating review", description: error.message, variant: "destructive" });
                setSubmitting(false);
                return;
            }
        } else {
            const { error } = await (supabase as any).from("classroom_reviews").insert(payload);
            if (error) {
                if (error.code === "23505") {
                    toast({ title: "You've already reviewed this class" });
                } else {
                    toast({ title: "Error submitting review", description: error.message, variant: "destructive" });
                }
                setSubmitting(false);
                return;
            }
        }

        setEditing(false);
        setSubmitting(false);
        setShowSuccess(true);
        setTimeout(() => {
            setShowSuccess(false);
            fetchReviews();
            onReviewSubmitted?.();
        }, 1500);
    };

    if (compact) {
        if (showSuccess) {
            return (
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center justify-center py-6 text-center space-y-3"
                >
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", bounce: 0.5 }}
                        className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400"
                    >
                        <CheckCircle2 className="w-6 h-6" />
                    </motion.div>
                    <p className="font-bold text-foreground">Thank you!</p>
                    <p className="text-xs text-muted-foreground">Your review has been posted.</p>
                </motion.div>
            );
        }

        return (
            <motion.div layout className="space-y-4">
                <p className="font-extrabold text-foreground text-sm">How was this class?</p>
                <StarRating value={rating} onChange={setRating} size="lg" />
                <Textarea
                    placeholder="Share your experience (optional)"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="rounded-xl text-sm min-h-[60px] resize-none focus:bg-background transition-colors bg-muted/30"
                    rows={2}
                />
                <button
                    type="button"
                    className="text-xs text-primary font-bold hover:underline"
                    onClick={() => setShowOptional(!showOptional)}
                >
                    {showOptional ? "Hide" : "Rate"} video & voice quality
                </button>
                <AnimatePresence>
                    {showOptional && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Video className="w-3 h-3" /> Video</p>
                                    <StarRating value={videoRating} onChange={setVideoRating} size="sm" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Volume2 className="w-3 h-3" /> Voice</p>
                                    <StarRating value={voiceRating} onChange={setVoiceRating} size="sm" />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
                <Button
                    onClick={handleSubmit}
                    disabled={submitting || rating === 0}
                    size="sm"
                    className="rounded-xl edu-btn-primary font-bold gap-2 w-full"
                >
                    <Send className="w-3.5 h-3.5" />
                    {submitting ? "Saving..." : myReview ? "Update Review" : "Post Review"}
                </Button>
            </motion.div>
        );
    }

    const showForm = !isOwner && (!myReview || editing);

    return (
        <div className="space-y-6">
            {summary && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="edu-card p-6 overflow-hidden relative"
                >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-400/10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none" />
                    <div className="flex flex-wrap items-center gap-6 relative z-10">
                        <div className="text-center">
                            <p className="text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-br from-amber-500 to-orange-400">{summary.avg_rating}</p>
                            <StarRating value={Math.round(summary.avg_rating)} readonly size="md" />
                            <p className="text-xs font-bold text-muted-foreground mt-1 uppercase tracking-wider">
                                {summary.review_count} review{summary.review_count !== 1 ? "s" : ""}
                            </p>
                        </div>
                        {(summary.avg_video_rating || summary.avg_voice_rating) && (
                            <div className="flex gap-4 text-sm bg-muted/40 p-3 rounded-2xl">
                                {summary.avg_video_rating && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm">
                                            <Video className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <span className="block font-bold leading-tight">{summary.avg_video_rating}</span>
                                            <span className="text-muted-foreground text-[10px] font-bold uppercase">Video</span>
                                        </div>
                                    </div>
                                )}
                                {summary.avg_voice_rating && (
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center shadow-sm">
                                            <Volume2 className="w-4 h-4 text-primary" />
                                        </div>
                                        <div>
                                            <span className="block font-bold leading-tight">{summary.avg_voice_rating}</span>
                                            <span className="text-muted-foreground text-[10px] font-bold uppercase">Voice</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </motion.div>
            )}

            <AnimatePresence mode="wait">
                {showSuccess && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="edu-card p-10 flex flex-col items-center justify-center text-center space-y-4 bg-gradient-to-b from-emerald-50 to-background dark:from-emerald-950/20"
                    >
                        <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-inner"
                        >
                            <CheckCircle2 className="w-8 h-8" />
                        </motion.div>
                        <div>
                            <h3 className="text-xl font-display text-foreground">Review Posted!</h3>
                            <p className="text-sm text-muted-foreground mt-1">Thank you for sharing your experience.</p>
                        </div>
                    </motion.div>
                )}

                {showForm && !showSuccess && (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="edu-card p-6 space-y-5 border-amber-200/50 bg-amber-50/30 dark:border-amber-900/20 dark:bg-amber-950/10 overflow-hidden"
                    >
                        <h3 className="font-display text-xl text-foreground flex items-center gap-2">
                            <motion.div animate={{ rotate: [0, 15, -10, 0] }} transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.5 }}>
                                <Star className="w-5 h-5 text-amber-500 fill-amber-500 drop-shadow-sm" />
                            </motion.div>
                            {myReview ? "Edit your review" : "Rate this class"}
                        </h3>
                        <div>
                            <p className="text-sm font-bold text-foreground mb-2">Overall rating <span className="text-destructive">*</span></p>
                            <StarRating value={rating} onChange={setRating} size="xl" />
                        </div>
                        <Textarea
                            placeholder="What did you think about the explanations, material, or teaching style? (optional)"
                            value={comment}
                            onChange={(e) => setComment(e.target.value)}
                            className="rounded-2xl min-h-[100px] bg-background border-border/50 focus-visible:ring-amber-400 transition-shadow resize-none"
                        />
                        <button
                            type="button"
                            className="text-sm text-amber-600 dark:text-amber-400 font-bold hover:underline"
                            onClick={() => setShowOptional(!showOptional)}
                        >
                            {showOptional ? "Hide technical ratings" : "➕ Rate video & voice quality (optional)"}
                        </button>
                        <AnimatePresence>
                            {showOptional && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="overflow-hidden"
                                >
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                        <div className="bg-background p-4 rounded-xl border border-border/50 shadow-sm">
                                            <p className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                                                <Video className="w-4 h-4 text-primary" /> Video quality
                                            </p>
                                            <StarRating value={videoRating} onChange={setVideoRating} size="md" />
                                        </div>
                                        <div className="bg-background p-4 rounded-xl border border-border/50 shadow-sm">
                                            <p className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                                                <Volume2 className="w-4 h-4 text-primary" /> Voice quality
                                            </p>
                                            <StarRating value={voiceRating} onChange={setVoiceRating} size="md" />
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <div className="flex justify-end gap-3 pt-2">
                            {editing && (
                                <Button variant="outline" onClick={() => setEditing(false)} className="rounded-xl font-bold">
                                    Cancel
                                </Button>
                            )}
                            <Button
                                onClick={handleSubmit}
                                disabled={submitting || rating === 0}
                                className="rounded-xl shadow-md border border-amber-500/50 bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-amber-950 font-extrabold gap-2 px-6"
                            >
                                <Send className="w-4 h-4" />
                                {submitting ? "Saving..." : myReview ? "Update" : "Publish"}
                            </Button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {!isOwner && myReview && !editing && !showSuccess && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="edu-card p-5 border-amber-200/50 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-950/20 group hover:shadow-md transition-all"
                >
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">Your Review</p>
                            <StarRating value={myReview.rating} readonly size="md" />
                            {myReview.comment && (
                                <p className="text-sm text-foreground my-3 leading-relaxed">{myReview.comment}</p>
                            )}
                            {(myReview.video_rating || myReview.voice_rating) && (
                                <div className="flex gap-4 mt-3 pt-3 border-t border-amber-200/50 dark:border-amber-800/50 text-xs font-medium text-muted-foreground">
                                    {myReview.video_rating && (
                                        <span className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-md shadow-sm border border-border/50">
                                            <Video className="w-3.5 h-3.5 text-primary" /> {myReview.video_rating}/5
                                        </span>
                                    )}
                                    {myReview.voice_rating && (
                                        <span className="flex items-center gap-1.5 bg-background px-2 py-1 rounded-md shadow-sm border border-border/50">
                                            <Volume2 className="w-3.5 h-3.5 text-primary" /> {myReview.voice_rating}/5
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(true)}
                            className="rounded-xl text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background shadow-sm border border-border/50 hover:bg-muted"
                        >
                            <Pencil className="w-3 h-3" /> Edit
                        </Button>
                    </div>
                </motion.div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <motion.div
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
                        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                    >
                        <Star className="w-8 h-8 text-amber-400 fill-amber-400" />
                    </motion.div>
                </div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-16 px-4">
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-20 h-20 mx-auto bg-muted/30 rounded-full flex items-center justify-center mb-4"
                    >
                        <MessageSquareText className="w-10 h-10 text-muted-foreground/30" />
                    </motion.div>
                    <h3 className="font-display text-xl text-foreground mb-2">No reviews yet</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                        {isOwner
                            ? "Reviews left by students will appear here to help you get feedback."
                            : "Be the first to share your experience to help others!"}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <h3 className="font-display text-lg text-foreground px-1">Community Reviews</h3>
                    <motion.div variants={listVariants} initial="hidden" animate="visible" className="grid gap-3">
                        {reviews.map((r) => (
                            <motion.div key={r.id} variants={itemVariants} className="edu-card p-5 hover:shadow-md transition-shadow">
                                <div className="flex gap-4">
                                    <UserHoverCard userId={r.user_id}>
                                        <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity shrink-0">
                                            <Avatar className="h-10 w-10 rounded-full border-2 border-background shadow-sm shrink-0">
                                                <AvatarFallback className="text-sm font-bold bg-gradient-to-br from-primary/20 to-primary/10 text-primary">
                                                    {(r.reviewer_name ?? "?").slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-extrabold text-foreground hover:text-primary hover:underline">{r.reviewer_name ?? "Student"}</span>
                                                {r.is_explorer && (
                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold uppercase tracking-wide">
                                                        Explorer
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </UserHoverCard>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
                                            <div className="flex items-center gap-2 flex-wrap">
                                            </div>
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                                                {formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <StarRating value={r.rating} readonly size="sm" />
                                        {r.comment && (
                                            <p className="text-sm text-foreground mt-3 leading-relaxed">{r.comment}</p>
                                        )}
                                        {(r.video_rating || r.voice_rating) && (
                                            <div className="flex gap-3 mt-3 text-xs font-medium text-muted-foreground bg-muted/30 p-2 rounded-xl inline-flex w-fit">
                                                {r.video_rating && (
                                                    <span className="flex items-center gap-1.5">
                                                        <Video className="w-3.5 h-3.5 text-primary" /> {r.video_rating}/5
                                                    </span>
                                                )}
                                                {r.voice_rating && (
                                                    <span className="flex items-center gap-1.5">
                                                        <Volume2 className="w-3.5 h-3.5 text-primary" /> {r.voice_rating}/5
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            )}
        </div>
    );
}
