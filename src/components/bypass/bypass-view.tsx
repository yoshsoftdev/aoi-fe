import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2 } from 'lucide-react'
import { bypassService, type Bypass, type BypassRule, type BypassAction } from '@/services/bypassService'
import { parameterService } from '@/services/parameterService'
import { setPointService, type SetPoint } from '@/services/setPointService'

interface EditableBypass extends Omit<Bypass, 'id' | 'created_at' | 'updated_at'> {
  id?: number
}

export function BypassView() {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState<EditableBypass | null>(null)

  const { data: bypasses = [], isLoading } = useQuery<Bypass[]>({
    queryKey: ['bypasses'],
    queryFn: () => bypassService.getAll(),
  })

  const { data: parameters = [] } = useQuery({
    queryKey: ['parameters'],
    queryFn: () => parameterService.getAll(),
  })

  const { data: setPoints = [] } = useQuery<SetPoint[]>({
    queryKey: ['set-points'],
    queryFn: () => setPointService.getAll(),
  })

  const upsertMutation = useMutation({
    mutationFn: (payload: EditableBypass) => {
      if (payload.id) {
        return bypassService.update(payload.id, {
          name: payload.name,
          enabled: payload.enabled,
          description: payload.description,
          rules: payload.rules,
          actions: payload.actions,
        })
      }
      return bypassService.create({
        name: payload.name,
        enabled: payload.enabled,
        description: payload.description,
        rules: payload.rules,
        actions: payload.actions,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bypasses'] })
      setEditing(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => bypassService.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bypasses'] })
    },
  })

  const startCreate = () => {
    setEditing({
      name: '',
      enabled: true,
      description: '',
      rules: [],
      actions: [],
    })
  }

  const startEdit = (b: Bypass) => {
    setEditing({
      id: b.id,
      name: b.name,
      enabled: b.enabled,
      description: b.description,
      rules: b.rules || [],
      actions: b.actions || [],
    })
  }

  const updateRule = (index: number, patch: Partial<BypassRule>) => {
    if (!editing) return
    const next = [...editing.rules]
    next[index] = { ...next[index], ...patch }
    setEditing({ ...editing, rules: next })
  }

  const addRule = () => {
    if (!editing) return
    const defaultLeft =
      setPoints[0]?.id != null
        ? { left_source_type: 'set_point' as const, left_source_id: setPoints[0].id }
        : { left_source_type: 'parameter' as const, left_source_id: parameters[0]?.id || 0 }
    setEditing({
      ...editing,
      rules: [
        ...editing.rules,
        {
          condition_type: 'compare',
          ...defaultLeft,
          operator: '>' as const,
          right_value_type: 'static',
          right_value: 0,
        },
      ],
    })
  }

  const removeRule = (index: number) => {
    if (!editing) return
    setEditing({ ...editing, rules: editing.rules.filter((_, i) => i !== index) })
  }

  const updateAction = (index: number, patch: Partial<BypassAction>) => {
    if (!editing) return
    const next = [...editing.actions]
    next[index] = { ...next[index], ...patch }
    setEditing({ ...editing, actions: next })
  }

  const addAction = () => {
    if (!editing) return
    if (parameters.length === 0) {
      alert('Tidak ada parameter WRITE tersedia')
      return
    }
    setEditing({
      ...editing,
      actions: [
        ...editing.actions,
        {
          write_parameter_id: parameters[0].id,
          value_source_type: 'static',
          value: 0,
        },
      ],
    })
  }

  const removeAction = (index: number) => {
    if (!editing) return
    setEditing({ ...editing, actions: editing.actions.filter((_, i) => i !== index) })
  }

  const handleSave = () => {
    if (!editing) return
    if (!editing.name.trim()) {
      alert('Nama wajib diisi')
      return
    }
    if (editing.rules.length === 0) {
      alert('Minimal satu rule IF diperlukan')
      return
    }
    if (editing.actions.length === 0) {
      alert('Minimal satu aksi THEN WRITE diperlukan')
      return
    }
    upsertMutation.mutate(editing)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bypass</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Workflow ringan untuk manual override. WRITE selalu dieksekusi di engine, bukan dari frontend.
          </p>
        </div>
        <Button onClick={startCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Buat Bypass
        </Button>
      </div>

      <Separator />

      {/* List bypass */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Memuat bypass...</p>
      ) : bypasses.length === 0 ? (
        <p className="text-sm text-muted-foreground">Belum ada bypass dibuat.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bypasses.map((b) => (
            <Card key={b.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{b.name}</CardTitle>
                  <CardDescription>
                    {b.enabled ? 'Aktif' : 'Nonaktif'} · {b.rules.length} rule · {b.actions.length} aksi
                  </CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <Switch
                    checked={b.enabled}
                    onCheckedChange={(val) =>
                      upsertMutation.mutate({
                        id: b.id,
                        name: b.name,
                        enabled: val,
                        description: b.description,
                        rules: b.rules,
                        actions: b.actions,
                      })
                    }
                  />
                  <Button size="icon" variant="ghost" onClick={() => startEdit(b)}>
                    ✏️
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm('Hapus bypass ini?')) deleteMutation.mutate(b.id)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* Editor */}
      {editing && (
        <Card>
          <CardHeader>
            <CardTitle>{editing.id ? 'Edit Bypass' : 'Bypass Baru'}</CardTitle>
            <CardDescription>Definisikan IF (kondisi) dan THEN WRITE (aksi).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Nama *</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editing.enabled}
                    onCheckedChange={(v) => setEditing({ ...editing, enabled: v })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {editing.enabled ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input
                  value={editing.description || ''}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value || undefined })
                  }
                />
              </div>
            </div>

            <Separator />

            {/* IF */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">IF (Kondisi)</h3>
                <p className="text-xs text-muted-foreground">
                  Gunakan set-point / parameter sebagai sumber kondisi.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addRule}>
                <Plus className="h-4 w-4 mr-1" />
                Tambah Kondisi
              </Button>
            </div>

            {editing.rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada kondisi. Tambahkan minimal satu rule.
              </p>
            ) : (
              <div className="space-y-3">
                {editing.rules.map((r, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Kondisi #{idx + 1}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeRule(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="space-y-1">
                        <Label>Mode</Label>
                        <Select
                          value={r.condition_type}
                          onValueChange={(v) =>
                            updateRule(idx, { condition_type: v as BypassRule['condition_type'] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="compare">Bandingkan nilai</SelectItem>
                            <SelectItem value="always">
                              Always (selalu true saat dievaluasi)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Sumber Kiri</Label>
                        <Select
                          value={r.left_source_type}
                          onValueChange={(v) =>
                            updateRule(idx, {
                              left_source_type: v as BypassRule['left_source_type'],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="set_point">Set-Point</SelectItem>
                            <SelectItem value="parameter">Parameter</SelectItem>
                          </SelectContent>
                        </Select>
                        <Select
                          value={String(r.left_source_id || '')}
                          onValueChange={(v) =>
                            updateRule(idx, { left_source_id: Number(v) })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih sumber" />
                          </SelectTrigger>
                          <SelectContent>
                            {r.left_source_type === 'set_point'
                              ? setPoints.map((sp) => (
                                  <SelectItem key={sp.id} value={String(sp.id)}>
                                    {sp.name} {sp.unit && `(${sp.unit})`}
                                  </SelectItem>
                                ))
                              : parameters.map((p) => (
                                  <SelectItem key={p.id} value={String(p.id)}>
                                    {p.nama} {p.unit && `(${p.unit})`}
                                  </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Operator</Label>
                        <Select
                          disabled={r.condition_type === 'always'}
                          value={r.operator || '>'}
                          onValueChange={(v) =>
                            updateRule(idx, { operator: v as BypassRule['operator'] })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value=">">{'>'}</SelectItem>
                            <SelectItem value="<">{'<'}</SelectItem>
                            <SelectItem value=">=">{'>='}</SelectItem>
                            <SelectItem value="<=">{'<='}</SelectItem>
                            <SelectItem value="=">=</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Nilai Kanan</Label>
                        <Select
                          disabled={r.condition_type === 'always'}
                          value={r.right_value_type}
                          onValueChange={(v) =>
                            updateRule(idx, {
                              right_value_type:
                                v as BypassRule['right_value_type'],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Static</SelectItem>
                            <SelectItem value="set_point">Set-Point</SelectItem>
                          </SelectContent>
                        </Select>
                        {r.right_value_type === 'static' ? (
                          <Input
                            type="number"
                            step="any"
                            disabled={r.condition_type === 'always'}
                            value={r.right_value ?? 0}
                            onChange={(e) =>
                              updateRule(idx, {
                                right_value: Number(e.target.value) || 0,
                              })
                            }
                          />
                        ) : (
                          <Select
                            disabled={r.condition_type === 'always'}
                            value={r.right_source_id ? String(r.right_source_id) : ''}
                            onValueChange={(v) =>
                              updateRule(idx, {
                                right_source_id: Number(v),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih set-point" />
                            </SelectTrigger>
                            <SelectContent>
                              {setPoints.map((sp) => (
                                <SelectItem key={sp.id} value={String(sp.id)}>
                                  {sp.name} {sp.unit && `(${sp.unit})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <Separator />

            {/* THEN WRITE */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">THEN WRITE (Aksi)</h3>
                <p className="text-xs text-muted-foreground">
                  Satu bypass boleh memiliki beberapa aksi WRITE secara berurutan.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={addAction}>
                <Plus className="h-4 w-4 mr-1" />
                Tambah Aksi
              </Button>
            </div>

            {editing.actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Belum ada aksi. Tambahkan minimal satu WRITE.
              </p>
            ) : (
              <div className="space-y-3">
                {editing.actions.map((a, idx) => (
                  <div key={idx} className="border rounded-md p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Aksi #{idx + 1}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeAction(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Parameter WRITE</Label>
                        <Select
                          value={String(a.write_parameter_id)}
                          onValueChange={(v) =>
                            updateAction(idx, {
                              write_parameter_id: Number(v),
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {parameters.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.nama} {p.unit && `(${p.unit})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Sumber Nilai</Label>
                        <Select
                          value={a.value_source_type}
                          onValueChange={(v) =>
                            updateAction(idx, {
                              value_source_type:
                                v as BypassAction['value_source_type'],
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">Static</SelectItem>
                            <SelectItem value="set_point">Dari Set-Point</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label>Nilai</Label>
                        {a.value_source_type === 'static' ? (
                          <Input
                            type="number"
                            step="any"
                            value={a.value ?? 0}
                            onChange={(e) =>
                              updateAction(idx, {
                                value: Number(e.target.value) || 0,
                              })
                            }
                          />
                        ) : (
                          <Select
                            value={
                              a.source_set_point_id
                                ? String(a.source_set_point_id)
                                : ''
                            }
                            onValueChange={(v) =>
                              updateAction(idx, {
                                source_set_point_id: Number(v),
                              })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih set-point" />
                            </SelectTrigger>
                            <SelectContent>
                              {setPoints.map((sp) => (
                                <SelectItem key={sp.id} value={String(sp.id)}>
                                  {sp.name} {sp.unit && `(${sp.unit})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditing(null)}>
                Batal
              </Button>
              <Button onClick={handleSave} disabled={upsertMutation.isLoading}>
                Simpan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

