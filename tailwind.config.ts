mkdir -p public/fonts
cp "/Users/stefanoschintu/Desktop/Develop/ClearUX/PNG/Heuvel Grotesk-VF.ttf" public/fonts/ 2>/dev/null || cp ~/Downloads/"Heuvel Grotesk-VF.ttf" public/fonts/ 2>/dev/null
ls public/fonts/
git add src/app/layout.tsx tailwind.config.ts "public/fonts/Heuvel Grotesk-VF.ttf"
git commit -m "Add Heuvel Grotesk as heading font, DM Sans stays as body"
git push origin main