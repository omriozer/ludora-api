#!/bin/bash

# Script to run template diagnostics on production
# Usage: ./run-diagnostics-prod.sh [lessonPlanId]

echo "🚀 Running Lesson Plan Template Diagnostics on Production..."

if [ "$1" != "" ]; then
    echo "📋 Targeting specific lesson plan: $1"
    heroku run --app ludora-api-prod "node scripts/diagnose-lesson-plan-templates.js $1"
else
    echo "📊 Analyzing all lesson plans"
    heroku run --app ludora-api-prod "node scripts/diagnose-lesson-plan-templates.js"
fi

echo "✅ Diagnostics completed"