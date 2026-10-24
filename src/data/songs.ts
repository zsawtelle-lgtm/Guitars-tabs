import type { Song } from "../lib/storage";

// Traditional / public-domain songs bundled so the app is usable out of the box.
export const BUILT_IN_SONGS: Song[] = [
  {
    id: "house-of-the-rising-sun",
    title: "House of the Rising Sun",
    artist: "Traditional",
    key: "Am",
    tempo: 76,
    beatsPerBar: 3,
    duration: 210,
    builtIn: true,
    body: `[Intro]
  Am           C            D            F
e|------0-----|------0-----|------2-----|------1-----|
B|----1---1---|----1---1---|----3---3---|----1---1---|
G|--2-------2-|--0-------0-|--2-------2-|--2-------2-|
D|------------|------------|0-----------|3-----------|
A|0-----------|3-----------|------------|------------|
E|------------|------------|------------|------------|

[Verse 1]
There [Am]is a [C]house in [D]New Or[F]leans
They [Am]call the [C]Rising [E]Sun
And it's [Am]been the [C]ruin of [D]many a poor [F]boy
And [Am]God, I [E]know I'm [Am]one [C] [D] [F] [Am] [E] [Am] [E]

[Verse 2]
My [Am]mother [C]was a [D]tailor [F]
She [Am]sewed my [C]new blue [E]jeans
My [Am]father [C]was a [D]gamblin' [F]man
Down [Am]in New [E]Orle[Am]ans [C] [D] [F] [Am] [E] [Am] [E]

[Verse 3]
Now the [Am]only [C]thing a [D]gambler [F]needs
Is a [Am]suitcase [C]and a [E]trunk
And the [Am]only [C]time he's [D]satis[F]fied
Is [Am]when he's [E]on a [Am]drunk [C] [D] [F] [Am] [E] [Am] [E]

[Verse 4]
Oh [Am]mother, [C]tell your [D]children [F]
Not to [Am]do what [C]I have [E]done
[Am]Spend your [C]lives in [D]sin and [F]misery
In the [Am]House of the [E]Rising [Am]Sun [C] [D] [F] [Am] [E] [Am] [E]

[Outro]
[Am] [C] [D] [F] [Am] [E] [Am]`,
  },
  {
    id: "amazing-grace",
    title: "Amazing Grace",
    artist: "John Newton",
    key: "G",
    tempo: 80,
    beatsPerBar: 3,
    duration: 180,
    builtIn: true,
    body: `[Verse 1]
A[G]mazing [G7]grace, how [C]sweet the [G]sound
That [G]saved a wretch like [D]me
I [G]once was [G7]lost, but [C]now am [G]found
Was [Em]blind, but [D]now I [G]see

[Verse 2]
'Twas [G]grace that [G7]taught my [C]heart to [G]fear
And [G]grace my fears re[D]lieved
How [G]precious [G7]did that [C]grace ap[G]pear
The [Em]hour I [D]first be[G]lieved

[Verse 3]
Through [G]many [G7]dangers, [C]toils and [G]snares
I [G]have already [D]come
'Tis [G]grace hath [G7]brought me [C]safe thus [G]far
And [Em]grace will [D]lead me [G]home

[Verse 4]
When [G]we've been [G7]there ten [C]thousand [G]years
Bright [G]shining as the [D]sun
We've [G]no less [G7]days to [C]sing God's [G]praise
Than [Em]when we'd [D]first be[G]gun`,
  },
  {
    id: "oh-susanna",
    title: "Oh! Susanna",
    artist: "Stephen Foster",
    key: "C",
    tempo: 112,
    beatsPerBar: 4,
    duration: 150,
    builtIn: true,
    body: `[Verse 1]
C                                       G
  I come from Alabama with my banjo on my knee
C                                   G       C
  I'm going to Louisiana, my true love for to see

[Chorus]
F                  C              G
  Oh, Susanna, oh don't you cry for me
       C                                    G        C
  For I come from Alabama with my banjo on my knee

[Verse 2]
C                                      G
  It rained all night the day I left, the weather it was dry
C                                        G        C
  The sun so hot I froze to death, Susanna, don't you cry

[Chorus]
F                  C              G
  Oh, Susanna, oh don't you cry for me
       C                                    G        C
  For I come from Alabama with my banjo on my knee`,
  },
  {
    id: "scarborough-fair",
    title: "Scarborough Fair",
    artist: "Traditional",
    key: "Am",
    tempo: 96,
    beatsPerBar: 3,
    duration: 190,
    builtIn: true,
    body: `[Verse 1]
[Am]Are you going to [G]Scarborough [Am]Fair?
[C]Parsley, [Am]sage, rose[D]mary and [Am]thyme
Re[Am]member [C]me to one who [G]lives there
[Am]She once [G]was a true [Em]love of [Am]mine

[Verse 2]
[Am]Tell her to make me a [G]cambric [Am]shirt
[C]Parsley, [Am]sage, rose[D]mary and [Am]thyme
With[Am]out [C]any seam or [G]needlework
[Am]Then she'll [G]be a true [Em]love of [Am]mine

[Verse 3]
[Am]Tell her to find me an [G]acre of [Am]land
[C]Parsley, [Am]sage, rose[D]mary and [Am]thyme
Be[Am]tween the [C]salt water [G]and the sea strand
[Am]Then she'll [G]be a true [Em]love of [Am]mine`,
  },
  {
    id: "greensleeves",
    title: "Greensleeves",
    artist: "Traditional",
    key: "Am",
    tempo: 84,
    beatsPerBar: 3,
    duration: 200,
    builtIn: true,
    body: `[Verse]
A[Am]las, my [G]love, you [F]do me [E]wrong
To [Am]cast me [G]off dis[E]courteous[Am]ly [E]
For [Am]I have [G]loved you [F]well and [E]long
De[Am]lighting [G]in your [E]compan[Am]y

[Chorus]
[C]Greensleeves was [G]all my [Em]joy
[Am]Greensleeves was [E]my de[E7]light
[C]Greensleeves was my [G]heart of [Em]gold
And [Am]who but my [E]lady [Am]Greensleeves`,
  },
  {
    id: "red-river-valley",
    title: "Red River Valley",
    artist: "Traditional",
    key: "G",
    tempo: 100,
    beatsPerBar: 4,
    duration: 170,
    builtIn: true,
    body: `[Verse 1]
G
From this valley they say you are going
                                   D7
We will miss your bright eyes and sweet smile
          G                   G7          C
For they say you are taking the sunshine
       G             D7          G
That has brightened our pathway a while

[Chorus]
G
Come and sit by my side if you love me
                                    D7
Do not hasten to bid me adieu
          G                 G7        C
But remember the Red River Valley
       G           D7          G
And the one who has loved you so true`,
  },
  {
    id: "when-the-saints",
    title: "When the Saints Go Marching In",
    artist: "Traditional",
    key: "G",
    tempo: 120,
    beatsPerBar: 4,
    duration: 120,
    builtIn: true,
    body: `[Verse 1]
Oh, when the [G]saints go marching in
Oh, when the saints go marching [D]in
Oh Lord, I [G]want to [G7]be in that [C]number
When the [G]saints go [D]marching [G]in

[Verse 2]
Oh, when the [G]sun refuse to shine
Oh, when the sun refuse to [D]shine
Oh Lord, I [G]want to [G7]be in that [C]number
When the [G]sun re[D]fuse to [G]shine

[Verse 3]
Oh, when the [G]stars fall from the sky
Oh, when the stars fall from the [D]sky
Oh Lord, I [G]want to [G7]be in that [C]number
When the [G]stars fall [D]from the [G]sky`,
  },
];
