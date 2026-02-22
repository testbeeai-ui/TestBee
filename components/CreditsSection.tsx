"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { ExternalLink, UserPlus, Send } from "lucide-react";

interface CreditsSectionProps {
    rdmBalance: number;
    userHandle: string;
}

export function CreditsSection({ rdmBalance, userHandle }: CreditsSectionProps) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(`https://test-bee-sigma.vercel.app/ref/${userHandle}`);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy text: ", err);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-sky-50 dark:bg-sky-950/20 rounded-2xl border border-sky-100 dark:border-sky-900/50 overflow-hidden relative"
        >
            <div className="p-8 pb-0 text-center">
                {rdmBalance < 50 && (
                    <p className="text-edu-orange font-bold text-lg mb-2">
                        You&apos;re running low on credits
                    </p>
                )}

                <div className="flex items-center justify-center gap-3 mb-4">
                    <motion.div
                        animate={{
                            rotate: [0, 15, -15, 0],
                            scale: [1, 1.2, 1]
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            repeatType: "reverse"
                        }}
                    >
                        <Sparkles className="w-10 h-10 text-edu-orange fill-edu-orange" />
                    </motion.div>
                    <span className="text-5xl font-extrabold text-foreground tracking-tight">
                        <span className="text-edu-orange">{rdmBalance}</span> credits
                    </span>
                </div>

                <p className="text-muted-foreground max-w-md mx-auto mb-8 font-medium">
                    Credits let you create and edit with AI. Each user in your
                    workspace gets their own credits.
                </p>
            </div>

            <div className="bg-background pt-2 px-6 pb-6 rounded-t-3xl border-t border-border shadow-[0_-8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_-8px_30px_rgb(0,0,0,0.2)]">
                <Tabs defaultValue="get-more" className="w-full">
                    <TabsList className="bg-transparent border-b border-border w-full flex justify-start rounded-none h-auto p-0 mb-6 gap-6 overflow-x-auto hide-scrollbar">
                        <TabsTrigger
                            value="get-more"
                            className="px-1 py-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-bold text-base transition-all"
                        >
                            Get more credits
                        </TabsTrigger>
                        <TabsTrigger
                            value="refer"
                            className="px-1 py-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-bold text-base text-muted-foreground transition-all flex items-center gap-2"
                        >
                            <Send className="w-4 h-4" />
                            Refer a friend
                        </TabsTrigger>
                        <TabsTrigger
                            value="invite"
                            className="px-1 py-4 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none font-bold text-base text-muted-foreground transition-all flex items-center gap-2"
                        >
                            <UserPlus className="w-4 h-4" />
                            Invite a teammate
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="get-more" className="mt-0 outline-none">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="border-2 border-primary/20 bg-primary/5 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 hover:border-primary/40 transition-colors"
                        >
                            <div>
                                <h4 className="font-extrabold text-lg text-foreground mb-1">More power, fewer limits</h4>
                                <p className="text-muted-foreground font-medium text-sm">
                                    Upgrade for more credits, advanced AI models, and
                                    branding tools.
                                </p>
                            </div>
                            <Button className="rounded-full px-6 font-bold shrink-0 shadow-md hover:shadow-lg transition-shadow bg-foreground text-background hover:bg-foreground/90">
                                Upgrade
                            </Button>
                        </motion.div>

                        <Accordion type="single" collapsible className="w-full mb-6 max-w-2xl mx-auto space-y-2">
                            <AccordionItem value="item-1" className="border-border px-1">
                                <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-4 font-bold text-[15px]">
                                    What uses credits?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed font-medium pb-4">
                                    Generating texts, editing images with AI tools, running complex background removal operations, and answering advanced mock tests consume credits.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-2" className="border-border px-1">
                                <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-4 font-bold text-[15px]">
                                    How many credits do I get?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed font-medium pb-4">
                                    Free users receive 50 RDM Balance daily on login. You can increase this limit by referring friends or upgrading your account.
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="item-3" className="border-border px-1">
                                <AccordionTrigger className="hover:no-underline hover:text-primary transition-colors py-4 font-bold text-[15px]">
                                    How can I earn more credits?
                                </AccordionTrigger>
                                <AccordionContent className="text-muted-foreground leading-relaxed font-medium pb-4">
                                    Besides upgrading to a paid tier, participating in daily challenges, saving helpful study materials, and successfully referring classmates directly yield bonus credits.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>

                        <div className="flex justify-center">
                            <a href="#" className="inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-primary transition-colors">
                                Frequently asked questions
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        </div>
                    </TabsContent>

                    <TabsContent value="refer" className="mt-0 outline-none">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="py-12 text-center"
                        >
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Send className="w-8 h-8 text-primary ml-1" />
                            </div>
                            <h4 className="font-extrabold text-xl text-foreground mb-2">Invite friends, get credits</h4>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-6">Give your friends 100 free credits and receive 50 bonus credits when they solve their first mock test.</p>
                            <div className="flex max-w-sm mx-auto gap-2">
                                <div className="flex-1 bg-muted rounded-xl border border-border px-4 py-2.5 text-left text-sm font-medium text-muted-foreground font-mono flex items-center justify-between">
                                    <span className="truncate pr-2">test-bee-sigma.vercel.app/ref/{userHandle}</span>
                                    <button
                                        onClick={handleCopy}
                                        className={`font-bold transition-all flex items-center gap-1 ${copied ? 'text-edu-green' : 'text-primary hover:underline'}`}
                                        disabled={copied}
                                    >
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.span
                                                key={copied ? "copied" : "copy"}
                                                initial={{ opacity: 0, y: -5 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 5 }}
                                                transition={{ duration: 0.15 }}
                                                className="flex items-center gap-1"
                                            >
                                                {copied ? (
                                                    <>
                                                        <Check className="w-4 h-4" />
                                                        Copied!
                                                    </>
                                                ) : "Copy"}
                                            </motion.span>
                                        </AnimatePresence>
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </TabsContent>

                    <TabsContent value="invite" className="mt-0 outline-none">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="py-12 text-center"
                        >
                            <div className="w-16 h-16 bg-edu-green/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                <UserPlus className="w-8 h-8 text-edu-green" />
                            </div>
                            <h4 className="font-extrabold text-xl text-foreground mb-2">Build your study group</h4>
                            <p className="text-muted-foreground max-w-sm mx-auto mb-6">Invite classmates to your workspace to share notes, flashcards, and compete in team mock exams.</p>
                            <Button className="rounded-full px-6 font-bold edu-btn-primary">
                                Invite Teammates
                            </Button>
                        </motion.div>
                    </TabsContent>
                </Tabs>
            </div>
        </motion.div>
    );
}
