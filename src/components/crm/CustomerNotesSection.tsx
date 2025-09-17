import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Phone, Mail, Users, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface CustomerNote {
  id: string;
  note_text: string;
  note_type: string;
  created_at: string;
  updated_at: string;
}

interface CustomerNotesSectionProps {
  customerId: string;
}

const noteTypeOptions = [
  { value: 'general', label: 'General', icon: MessageSquare },
  { value: 'phone_call', label: 'Phone Call', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'meeting', label: 'Meeting', icon: Users },
  { value: 'follow_up', label: 'Follow Up', icon: Clock },
];

export default function CustomerNotesSection({ customerId }: CustomerNotesSectionProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [newNoteType, setNewNoteType] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchNotes();
  }, [customerId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customer_notes')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error('Error fetching notes:', error);
      toast({
        title: "Error",
        description: "Failed to load notes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const addNote = async () => {
    if (!newNote.trim()) return;

    try {
      setSaving(true);
      
      // Get contractor ID
      const { data: contractorData } = await supabase.rpc('get_current_contractor_id');
      
      const { error } = await supabase
        .from('customer_notes')
        .insert({
          customer_id: customerId,
          contractor_id: contractorData,
          note_text: newNote.trim(),
          note_type: newNoteType
        });

      if (error) throw error;

      setNewNote("");
      setNewNoteType("general");
      fetchNotes();
      
      toast({
        title: "Note Added",
        description: "Customer note has been saved",
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getNoteTypeIcon = (type: string) => {
    const option = noteTypeOptions.find(opt => opt.value === type);
    return option ? option.icon : MessageSquare;
  };

  const getNoteTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'phone_call': return 'default';
      case 'email': return 'secondary';
      case 'meeting': return 'destructive';
      case 'follow_up': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Loading notes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add New Note */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Note
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-3">
              <Textarea
                placeholder="Enter your note..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-3">
              <Select value={newNoteType} onValueChange={setNewNoteType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {noteTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <option.icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={addNote} 
                disabled={!newNote.trim() || saving}
                className="w-full"
              >
                {saving ? 'Adding...' : 'Add Note'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      <Card>
        <CardHeader>
          <CardTitle>Notes History ({notes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No notes yet. Add the first note above.
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note) => {
                const IconComponent = getNoteTypeIcon(note.note_type);
                return (
                  <div key={note.id} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={getNoteTypeBadgeVariant(note.note_type)}>
                          {noteTypeOptions.find(opt => opt.value === note.note_type)?.label || note.note_type}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(note.created_at).toLocaleString()}
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{note.note_text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}