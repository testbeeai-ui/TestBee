"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import ClassroomReviews from "@/components/ClassroomReviews";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MessageSquareHeart } from "lucide-react";

interface ReviewPopupProps {
    classroomId: string;
    classroomName: string;
}

const POPUP_PREFIX = "review_popup_";

export default function ReviewPopup({ classroomId, classroomName }: ReviewPopupProps) {
    const { user } = useAuth();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!user || !classroomId) return;

        const todayKey = `${POPUP_PREFIX}${classroomId}_${new Date().toISOString().slice(0, 10)}`;

        if (localStorage.getItem(todayKey)) return;

        (async () => {
            const { data } = await (supabase as any)
                .from("classroom_reviews")
                .select("id")
                .eq("classroom_id", classroomId)
                .eq("user_id", user.id)
                .maybeSingle();

            if (data) return;

            const { data: membership } = await supabase
                .from("classroom_members")
                .select("joined_at")
                .eq("classroom_id", classroomId)
                .eq("user_id", user.id)
                .maybeSingle();

            if (!membership) return;

            const joinedAt = new Date(membership.joined_at).getTime();
            const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
            if (joinedAt > oneDayAgo) return;

            localStorage.setItem(todayKey, "1");
            setOpen(true);
        })();
    }, [user?.id, classroomId]);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="rounded-3xl max-w-md p-0 overflow-hidden border-amber-200/50 dark:border-amber-900/30">
                <div className="bg-gradient-to-b from-amber-50 to-background dark:from-amber-950/20 p-6 space-y-4">
                    <DialogHeader className="space-y-4">
                        <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 200, damping: 15 }}
                            className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center relative shadow-inner"
                        >
                            <motion.div
                                animate={{ y: [0, -5, 0] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                            >
                                <MessageSquareHeart className="w-8 h-8 text-amber-500 fill-amber-500/20" />
                            </motion.div>
                            <motion.div
                                animate={{ scale: [1, 1.2, 1], rotate: [0, 45, 0] }}
                                transition={{ repeat: Infinity, duration: 3, delay: 0.5 }}
                                className="absolute -top-1 -right-1"
                            >
                                <Star className="w-5 h-5 text-amber-400 fill-amber-400 drop-shadow-sm" />
                            </motion.div>
                        </motion.div>
                        <div className="text-center space-y-1.5">
                            <DialogTitle className="font-display text-xl">
                                How is <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-primary font-extrabold">{classroomName}</span>?
                            </DialogTitle>
                            <DialogDescription className="text-sm">
                                Your review helps the teacher improve and helps other students decide.
                            </DialogDescription>
                        </div>
                    </DialogHeader>

                    <div className="bg-background/50 backdrop-blur-sm p-4 rounded-2xl border border-border/50 shadow-sm mt-4">
                        <ClassroomReviews
                            classroomId={classroomId}
                            isOwner={false}
                            compact
                            onReviewSubmitted={() => {
                                setTimeout(() => setOpen(false), 2000); // Allow success state to show
                            }}
                        />
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOpen(false)}
                        className="w-full text-muted-foreground hover:text-foreground rounded-xl"
                    >
                        Maybe later
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
