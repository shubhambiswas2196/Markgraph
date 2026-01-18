import { tool } from '@langchain/core/tools';
import { z } from 'zod';

// System Time Tools for Supervisor Agent
export const getCurrentTime = tool(
    async () => {
        const now = new Date();
        const date = now.toLocaleDateString();
        const time = now.toLocaleTimeString();
        const iso = now.toISOString();
        const unix = now.getTime();

        return `CURRENT SYSTEM DATE AND TIME:
- Date: ${date}
- Time: ${time}
- ISO Format: ${iso}
- Unix Timestamp: ${unix}
- Local Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
    },
    {
        name: 'get_current_time',
        description: 'ALWAYS call this tool when users ask for current date, time, or "what time is it". Returns the actual current system date and time with timezone information.',
        schema: z.object({})
    }
);

export const getSystemTimezone = tool(
    async () => {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const offset = new Date().getTimezoneOffset();
        const offsetHours = Math.abs(Math.floor(offset / 60));
        const offsetMinutes = Math.abs(offset % 60);
        const offsetString = `${offset < 0 ? '+' : '-'}${offsetHours.toString().padStart(2, '0')}:${offsetMinutes.toString().padStart(2, '0')}`;

        return `SYSTEM TIMEZONE INFORMATION:
- Timezone: ${timezone}
- UTC Offset: ${offsetString}
- Offset Minutes: ${offset}
- Current Local Time: ${new Date().toLocaleString()}`;
    },
    {
        name: 'get_system_timezone',
        description: 'Call this tool when users ask about timezone, UTC offset, or system time settings. Returns detailed timezone and offset information.',
        schema: z.object({})
    }
);

// Memory & Performance Tools for Data Analytics Agent
export const getMemoryUsage = tool(
    async () => {
        // Node.js memory usage
        const memUsage = process.memoryUsage();
        const rss = (memUsage.rss / 1024 / 1024).toFixed(2);
        const heapTotal = (memUsage.heapTotal / 1024 / 1024).toFixed(2);
        const heapUsed = (memUsage.heapUsed / 1024 / 1024).toFixed(2);
        const external = (memUsage.external / 1024 / 1024).toFixed(2);

        return `Memory Usage (MB):
- RSS: ${rss} MB (Resident Set Size)
- Heap Total: ${heapTotal} MB
- Heap Used: ${heapUsed} MB
- External: ${external} MB
- Heap Usage: ${((parseFloat(heapUsed) / parseFloat(heapTotal)) * 100).toFixed(1)}%`;
    },
    {
        name: 'get_memory_usage',
        description: 'Get current system memory usage statistics',
        schema: z.object({})
    }
);

export const getPerformanceStats = tool(
    async () => {
        const uptime = process.uptime();
        const cpuUsage = process.cpuUsage();
        const loadAvg = require('os').loadavg ? require('os').loadavg() : [0, 0, 0];

        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMinutes = Math.floor((uptime % 3600) / 60);
        const uptimeSeconds = Math.floor(uptime % 60);

        return `Performance Statistics:
- System Uptime: ${uptimeHours}h ${uptimeMinutes}m ${uptimeSeconds}s
- CPU User Time: ${(cpuUsage.user / 1000000).toFixed(2)}s
- CPU System Time: ${(cpuUsage.system / 1000000).toFixed(2)}s
- Load Average (1m, 5m, 15m): ${loadAvg.map((avg: number) => avg.toFixed(2)).join(', ')}
- Node.js Version: ${process.version}
- Platform: ${process.platform}`;
    },
    {
        name: 'get_performance_stats',
        description: 'Get system performance statistics including uptime and CPU usage',
        schema: z.object({})
    }
);

// Date/Time Formatting Tools for Content Creation Agent
export const formatDateTime = tool(
    async ({ date, format }) => {
        const targetDate = date ? new Date(date) : new Date();

        if (isNaN(targetDate.getTime())) {
            return `Error: Invalid date format. Please provide a valid date string.`;
        }

        const formats = {
            iso: targetDate.toISOString(),
            local: targetDate.toLocaleString(),
            date: targetDate.toLocaleDateString(),
            time: targetDate.toLocaleTimeString(),
            short: targetDate.toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            }),
            long: targetDate.toLocaleString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            })
        };

        const selectedFormat = formats[format as keyof typeof formats] || formats.iso;

        return `Formatted Date/Time:
- Input: ${date || 'current time'}
- Format: ${format || 'iso'}
- Result: ${selectedFormat}

Available formats: ${Object.keys(formats).join(', ')}`;
    },
    {
        name: 'format_date_time',
        description: 'Format dates and times in various styles (iso, local, date, time, short, long)',
        schema: z.object({
            date: z.string().optional().describe('Date string to format (defaults to current time)'),
            format: z.enum(['iso', 'local', 'date', 'time', 'short', 'long']).optional().describe('Format style (defaults to iso)')
        })
    }
);

export const getBusinessDays = tool(
    async ({ startDate, endDate }) => {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return `Error: Invalid date format. Please provide valid start and end dates.`;
        }

        if (start > end) {
            return `Error: Start date must be before end date.`;
        }

        let businessDays = 0;
        const currentDate = new Date(start);

        while (currentDate <= end) {
            const dayOfWeek = currentDate.getDay();
            // Monday = 1, Tuesday = 2, ..., Friday = 5 (excluding Saturday = 6, Sunday = 0)
            if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                businessDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const weekendDays = totalDays - businessDays;

        return `Business Days Calculation:
- Start Date: ${start.toLocaleDateString()}
- End Date: ${end.toLocaleDateString()}
- Total Days: ${totalDays}
- Business Days: ${businessDays}
- Weekend/Holiday Days: ${weekendDays}

Business days exclude Saturdays and Sundays.`;
    },
    {
        name: 'get_business_days',
        description: 'Calculate the number of business days between two dates (excluding weekends)',
        schema: z.object({
            startDate: z.string().describe('Start date in ISO format (YYYY-MM-DD)'),
            endDate: z.string().describe('End date in ISO format (YYYY-MM-DD)')
        })
    }
);

// Export tool collections for each agent
export const supervisorUtilityTools = [getCurrentTime, getSystemTimezone];
export const dataAnalyticsUtilityTools = [getMemoryUsage, getPerformanceStats];
export const contentCreationUtilityTools = [formatDateTime, getBusinessDays];
